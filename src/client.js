import DDP from 'ddp.js';

export default class RocketChat {

  constructor(rocketChatUrl, adminUsername, adminPassword, channelId, eventBus) {
    this._url = rocketChatUrl;
    this._adminUsername = adminUsername;
    this._adminPassword = adminPassword;
    this._channelId = channelId;
    this._eventBus = eventBus;
  }

  init() {
    let self = this;

    return new Promise(function (resolve, reject) {
      fetch(self._url + '/api/v1/login', {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-type': 'application/x-www-form-urlencoded'
        },
        body: `username=${self._adminUsername}&password=${self._adminPassword}`
      }).then(response => {
        if (response.ok) {
          response.json().then(json => {
            if (json.status !== 'success') {
              reject({ok: false, message: `Received error from Rocket.Chat server on login: ${json}`});
              return;
            }

            self._authToken = json.data.authToken;
            self._userId = json.data.userId;

            // self.getChannels();

            self.subscribeToChannel(self._channelId)
                .then(result=> {
                  if (result.ok) {
                    resolve({ok: true, message: result.message});
                  } else {
                    reject({
                      ok: false,
                      message: `Received error from Rocket.Chat server connecting channel: ${result.message}`
                    });
                  }
                })
                .catch(error => {
                  reject({ok: false, message: error});
                });
          });
        } else {
          reject({ok: false, message: 'HTTP error: ' + response.status});
        }
      }).catch(error => {
        reject({ok: false, message: error.message});
      });
    });
  }

  subscribeToChannel(channelId) {
    var from, args, data;

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
        self._ddpClient.method('login', [{'resume': self._authToken}]);

        const subId = self._ddpClient.sub('stream-room-messages', [channelId, false]);

        self._ddpClient.on('ready', message => {
          if (message.subs.includes(subId)) {
            resolve({ok: true, message: 'stream-room-messages subscription ready'});

            self._ddpClient.on('changed', message => {
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

              args = (message.fields || {}).args;
              if (args !== null && args !== undefined) {
                if (args.length > 0) {
                  from = args[0].u.username;
                  if (from !== self._adminUsername) { // TODO: do the real comparison
                    // new message from some chat room user other than the browser user
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
                    // TODO: handle more than one (first) entry in this array
                    args = args[0];

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
                    self._eventBus.emit('ucw:newRemoteMessage', data);
                  }
                }
              }
            });
          } else {
            reject({ok: false, message: `Could not subscribe to RC room messages: ${message}`});
          }
        });

        self._ddpClient.on('nosub', message => {
          reject({ok: false, message: `Could not subscribe to RC room messages: ${message}`});
        });
      });
    });
  }

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

  postMessage(data) {
    this._ddpClient.method('sendMessage', [
      {
        '_id': data.id,
        'rid': this._channelId,
        'msg': data.text
      }
    ]);
  }
}

// connect = {
//   "msg": "connect",
//   "version": "1",
//   "support": ["1"]
// }
// login = {
//   "msg": "method",
//   "method": "login",
//   "id": "42",
//   "params": [
//     {
//       "user": {"username": "catogonzalez@gmail.com"},
//       "password": {
//         "digest": "b1198969011b9259a66aef2a76a43513c4f20d9097dcfa275e8024c49605a3a2",
//         "algorithm": "sha-256"
//       }
//     }
//   ]
// }
//
// subscribe = {
//   "msg": "sub",
//   "id": "unique-id",
//   "name": "stream-room-messages",
//   "params":[
//     "room-id",
//     false
//   ]
// }
//
//
