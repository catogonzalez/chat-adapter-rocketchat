import DDP from 'ddp.js';
import sha256 from 'js-sha256';

export default class RocketChat {

  constructor(rocketChatUrl, adminUsername, adminPassword, mode, roomId, eventBus) {
    this._MODES = [
      'private', 'livechat'
    ];

    if (!this._MODES.includes(mode.toLowerCase())) {
      throw new Error(`RocketChat unsupported mode ${mode}: use either livechat or private`);
    }

    this._url = rocketChatUrl;
    this._adminUsername = adminUsername;
    this._adminPassword = adminPassword;
    this._mode = mode.toLowerCase();

    // when mode=='private' holds a channelId
    // when mode=='livechat' holds a departmentId
    this._roomId = roomId;
    this._eventBus = eventBus;
  }

  init() {
    let self = this;

    return new Promise(function (resolve, reject) {
      try {
        self.connectSocket()
        .then(response => {
              if (response.ok) {
                self.login()
                .then(response => {
                      if (response.ok) {
                        self.getOlderMessages()
                        .then(response => {
                              if (response.status === 200) {
                                self._lastMessages = response.data;
                                self.subscribeToChannel(self._roomId)
                                .then(response => {
                                      if (response.ok) {
                                        resolve({
                                          ok: true,
                                          message: 'Rocket Chat connected and subscribed to messages',
                                          message_count: self._messageCount,
                                          last_messages: self._lastMessages
                                        });
                                      } else {
                                        reject({ok: false, message: response.message});
                                      }
                                    },
                                    err => {
                                      reject({ok: false, message: err.message});
                                    });
                              } else {
                                reject({ok: false, message: response.message});
                              }
                            },
                            err => {
                              reject({ok: false, message: err.message});
                            });
                      } else {
                        reject({ok: false, message: response.message});
                      }
                    },
                    err => {
                      reject({ok: false, message: err.message});
                    });
              } else {
                reject({ok: false, message: response.message});
              }
            },
            err => {
              reject({ok: false, message: err.message});
            });
      } catch
          (err) {
        reject({ok: false, message: err.message});
      }
    });
  }

  connectSocket() {
    let self = this;
    var url = self._url + '/websocket';

    url = url.replace('https', 'wss');
    url = url.replace('http', 'ws');

    self._ddpClient = new DDP({
      endpoint: url,
      SocketConstructor: WebSocket
    });

    return new Promise(function (resolve, reject) {
      self._ddpClient.on('connected', () => {
        resolve({ok: true});
      });
    });
  }

  login() {
    var self = this;

    const methodId = self._ddpClient.method('login', [{
      'user': {'username': self._adminUsername},
      'password': {
        'digest': sha256(self._adminPassword),
        'algorithm': 'sha-256'
      }
    }]);

    return new Promise(function (resolve, reject) {
      self._ddpClient.on('result', message => {
        if (message.id === methodId) {
          if (!message.error) {
            self._authToken = message.result.token;
            self._userId = message.result.id;
            self._tokenExpires = message.result.tokenExpires; // TODO: handle expired tokens
            resolve({ok: true});
          } else {
            reject({ok: false, message: `Error logging in: ${message.error.message}`});
          }
        }
      });
    });
  }

  subscribeToChannel(channelId) {
    var self = this;

    return new Promise(function (resolve, reject) {
      const subId = self._ddpClient.sub('stream-room-messages', [channelId, false]);

      self._ddpClient.on('ready', message => {
        if (message.subs.includes(subId)) {

          self._ddpClient.on('changed', message => {
            self.handleNewMessage(message);
          });
          resolve({ok: true, message: 'stream-room-messages subscription ready'});
        } else {
          reject({ok: false, message: `Could not subscribe to RC room messages: ${message}`});
        }
      });

      self._ddpClient.on('nosub', message => {
        reject({ok: false, message: `Could not subscribe to RC room messages: ${message}`});
      });
    });
  }

  handleNewMessage(message) {
    // sample message: {
    //  "msg":"changed",
    //    "collection":"stream-room-messages",
    //    "id":"id",
    //    "fields":{
    //  "eventName":"GENERAL",
    //      "args":[
    //    {
    //      "_id":"RbT9h6EzGXf8m3QLm",
    //      "rid":"GENERAL",
    //      "msg":"change 1212",
    //      "ts":{
    //        "$date":1507482740977
    //      },
    //      "u":{
    //        "_id":"kFBkJkorhN3gStxnr",
    //        "username":"admin",
    //        "name":"admin"
    //      },
    //      "mentions":[
    //      ],
    //      "channels":[
    //      ],
    //      "_updatedAt":{
    //        "$date":1507482740990
    //      }
    //    }
    //  ]
    // }
    //
    // }
    var from;
    var data;
    var args = (message.fields || {}).args;

    if (args !== null && args !== undefined) {
      if (args.length > 0) {
        from = args[0].u._id;
        if (from !== this._userId) {
          // new message from some chat user other than the browser user
          // TODO: handle more than one (first) entry in this array
          args = args[0];
          data = this.convertMessage(args);
          this._eventBus.emit('ucw:newRemoteMessage', data);
        }
      }
    }
  }

  postMessage(data) {
    this._ddpClient.method('sendMessage', [
      {
        '_id': data.id,
        'rid': this._roomId,
        'msg': data.text
      }
    ]);
  }

  getOlderMessages(lastTime) {
    var self = this;
    var messages;

    const methodId = self._ddpClient.method('loadHistory', [
      self._roomId,
      lastTime === undefined ? null : {'$date': lastTime}, // since when to read
      10, // # of messages to retrieve
      {'$date': Date.now()} // last time user read messages
    ]);

    return new Promise(function (resolve, reject) {
      self._ddpClient.on('result', message => {
        if (message.id === methodId) {
          if (!message.error) {
            console.log(message.result.messages);
            self._messageCount = 1000; // TODO: figure out how to read a total message count from RC
            messages = message.result.messages;
            messages = messages.map(m => {
              return self.convertMessage(m);
            });
            messages.sort(function (a, b) {
              // Turn your strings into dates, and then subtract them
              // to get a value that is either negative, positive, or zero.
              return new Date(a.time) - new Date(b.time);
            });
            resolve({status: 200, data: messages});
          } else {
            reject({status: 500, message: `Error loading messages: ${message.error.message}`});
          }
        }
      });
    });
  }

  convertMessage(rocketMsg) {
    // Create new message for universal chat widget;
    // in 121 Services message format:
    // {
    //  time: msg.sent_at,
    //  from: {
    //    username: msg.session.bot.display_name,
    //    avatar: msg.session.bot.avatar_url
    //  },
    //  text: msg.text,
    //  direction: msg.direction,
    //  buttons: msg.buttons,
    //  elements: msg.elements,
    //  attachment: msg.attachment
    // }
    return {
      time: rocketMsg.ts.$date,
      from: {
        username: rocketMsg.u.name || rocketMsg.u.username,
        avatar: rocketMsg.avatar || ''
      },
      text: rocketMsg.msg,
      direction: rocketMsg.u._id === this._userId ? 1 : 2,
      buttons: null,
      elements: null,
      attachment: null
    };
  }

  // support function for dev purposes. Not used in production code
  // self.getChannels();
  getChannels() {
    fetch(this._url + '/api/v1/channels.list', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'X-Auth-Token': this._authToken,
        'X-User-Id': this._userId
      }
    }).then(response => {
      if (response.ok) {
        response.json().then(json => {
          console.log('channels:', json);
        });
      }
    });
  }
}
