import DDP from 'ddp.js';
import sha256 from 'js-sha256';

export default class RocketChat {

  constructor(config) {
    // config has:
    // deviceId: xyz,
    // backendUrl: http://rocket.chat,
    // username: username,
    // password: password,
    // mode: livechat or private,
    // roomId: when livechat => departmentId, when private => channelId,
    // eventBus: EventEmiter instance

    this._deviceId = config.deviceId;
    this._url = config.backendUrl;
    this._username = config.username;
    this._password = config.password;
    this._mode = config.mode.toLowerCase();
    this._roomId = config.roomId;
    this._eventBus = config.eventBus;

    console.debug('RC Adapter Client init', config);
  }

  init() {
    if (this._mode === 'private') {
      return this.initPrivateMode();
    }
    return this.initLivechatMode();
  }

  initPrivateMode() {
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
                                          user: {
                                            username: self._username,
                                            avatar: self._userAvatar
                                          },
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

  initLivechatMode() {
    let self = this;

    return new Promise(function (resolve, reject) {
      try {
        self.connectSocket()
        .then(response => {
              if (response.ok) {
                self.getInitialData()
                .then(response => {
                      if (response.ok) {
                        if (!self._livechatConfig.enabled) {
                          reject({ok: false, message: 'Livechat is not enabled in backend'});
                          return;
                        }
                        if (!self._livechatConfig.online) {
                          reject({ok: false, message: 'No livechat agents are online at this moment'});
                          return;
                        }
                        self.registerGuest()
                        .then(response => {
                              if (response.ok) {
                                self.loginWithToken()
                                .then(response => {
                                      if (response.ok) {
                                        if (self._livechatConfig.room !== null) {
                                          // there was a previous conversation: retrieve older messages on the same room
                                          self.getOlderMessages()
                                          .then(response => {
                                                if (response.status === 200) {
                                                  self._lastMessages = response.data;
                                                  self.subscribeToChannel(self._deviceId)
                                                  .then(response => {
                                                        if (response.ok) {
                                                          resolve({
                                                            ok: true,
                                                            message: 'Rocket Chat livechat connected and subscribed to messages',
                                                            user: {
                                                              username: self._username,
                                                              avatar: self._userAvatar
                                                            },
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
                                          // No previous conversation on livechat. Defer subscribeToChannel when first message is sent
                                          self._userAvatar = null;
                                          self._messageCount = 0;
                                          self._lastMessages = [];

                                          resolve({
                                            ok: true,
                                            message: 'Rocket Chat livechat connected. Will subscribe to room messages on first message sent.',
                                            user: {
                                              username: self._username,
                                              avatar: self._userAvatar
                                            },
                                            message_count: self._messageCount,
                                            last_messages: self._lastMessages
                                          });
                                        }
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
      'user': {'username': self._username},
      'password': {
        'digest': sha256(self._password),
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
          reject({ok: false, message: `Could not subscribe to RC room messages on ready: ${JSON.stringify(message)}`});
        }
      });

      self._ddpClient.on('nosub', message => {
        reject({ok: false, message: `Could not subscribe to RC room messages (nosub): ${JSON.stringify(message)}`});
      });
    });
  }

  getInitialData() {
    var self = this;

    const methodId = self._ddpClient.method('livechat:getInitialData', [self._deviceId]);

    return new Promise(function (resolve, reject) {
      self._ddpClient.on('result', message => {
        if (message.id === methodId) {
          if (!message.error) {
            console.debug('livechat config:', message);
            self._livechatConfig = message.result;
            resolve({ok: true});
          } else {
            reject({ok: false, message: `Error reading livechat configuration: ${message.error.message}`});
          }
        }
      });
    });
  }

  registerGuest() {
    var self = this;

    this._username = 'test1'; // TODO: check if this conflicts with normal username usage
    const methodId = self._ddpClient.method('livechat:registerGuest', [{
      'token': self._deviceId,
      'name': this._username,
      'email': 'test2@gmail.com',
      'department': self._roomId
    }]);

    return new Promise(function (resolve, reject) {
      self._ddpClient.on('result', message => {
        if (message.id === methodId) {
          if (!message.error) {
            console.debug('registered guest:', message);
            self._authToken = message.result.token;
            self._userId = message.result.userId;
            resolve({ok: true});
          } else {
            reject({ok: false, message: `Error registering livechat guest: ${message.error.message}`});
          }
        }
      });
    });
  }

  loginWithToken() {
    var self = this;

    const methodId = self._ddpClient.method('login', [{'resume': self._authToken}]);

    return new Promise(function (resolve, reject) {
      self._ddpClient.on('result', message => {
        if (message.id === methodId) {
          if (!message.error) {
            console.debug('Logged in with token:', message);
            self._tokenExpires = message.result.tokenExpires; // TODO: handle expired tokens
            resolve({ok: true});
          } else {
            reject({ok: false, message: `Error logging in with token: ${message.error.message}`});
          }
        }
      });
    });
  }

  sendMessageLivechat(data) {
    var self = this;

    const methodId = this._ddpClient.method('sendMessageLivechat', [
      {
        '_id': data.id,
        'rid': this._deviceId,
        'msg': data.text,
        'token': this._authToken
      }
    ]);

    self._ddpClient.on('result', message => {
      if (message.id === methodId) {
        if (!message.error) {
          console.debug('Sent livechat message returned:', message);
          if (self._messageCount === 0) {
            // first message: subscribe to room messages
            self.subscribeToChannel(message.result.rid)// message.result.rid appears to be the same rid sent on the message = this._deviceId
            .then(response => {
                  console.debug('subscribeToChannel returned', response);
                  if (response.ok) {
                    self._messageCount += 1;
                  } else {
                    console.error(`Error subscribing to livechat room: ${response.message}`);
                  }
                },
                err => {
                  console.error(`Error subscribing to livechat room: ${err.message}`);
                });
          }
        } else {
          console.error(`Error sending livechat message: ${message.error.message}`);
        }
      }
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
    if (this._mode === 'private') {
      this._ddpClient.method('sendMessage', [
        {
          '_id': data.id,
          'rid': this._roomId,
          'msg': data.text
        }
      ]);
    } else {
      this.sendMessageLivechat(data);
    }
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

    if (this._userAvatar === undefined && rocketMsg.avatar !== undefined) {
      // update user avatar
      // TODO: find a better method to read user avatar from RC
      this._userAvatar = rocketMsg.avatar;
    }

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
