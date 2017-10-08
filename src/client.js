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
                        self.subscribeToChannel(self._roomId)
                            .then(response => {
                              if (response.ok) {
                                resolve({ok: true, message: 'Rocket Chat connected and subscribed to messages'});
                              } else {
                                reject({ok: false, message: response.message});
                              }
                            });
                      } else {
                        reject({ok: false, message: response.message});
                      }
                    });
              } else {
                reject({ok: false, message: response.message});
              }
            });
      } catch (err) {
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
            self._authToken = message.result.authToken;
            self._userId = message.result.id;
            self._tokenExpires = message.result.tokenExpires; // TODO: handle expired tokens
            resolve({ok: true});
          } else {
            reject(':', message);
            reject({ok: false, message: `Error logging in: ${message}`});
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
        from = args[0].u.username;
        if (from !== self._adminUsername) {
          // new message from some chat user other than the browser user
          // TODO: handle more than one (first) entry in this array
          args = args[0];

          // Create new message for universal chat widget;
          // must be in 121 Services message format:
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
          data = {
            time: args.ts.$date,
            from: {
              username: from,
              avatar: ''
            },
            text: args.msg,
            direction: 2,
            buttons: null,
            elements: null,
            attachment: null
          };
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
