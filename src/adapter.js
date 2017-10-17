import EventEmitter from 'events';
import RocketChat from './client';

export default class ChatAdapterRocketChat {
  constructor() {
    this._MODES = [
      'private', 'livechat'
    ];

    this._name = 'ChatAdapterRocketChat';
    this._eventBus = new EventEmitter();
  }

  get name() {
    return this._name;
  }

  //
  // public API
  //
  init(config) {
    // sample config:
    // var config = {
    // backendUrl: 'https://chat-stg.121services.co',
    // mode: 'private', // or 'livechat'
    // initData: {
    //    username: 'admin',
    //    password: 'admin',
    //    data: {*roomId: YYY} <- when mode is 'private', fill in with a room id; when mode is 'livechat' fill in a departmentId
    // }
    // }

    // console.debug('RC Adapter init', config);

    this._deviceId = config.initData.data.deviceId;
    this._mode = config.mode.toLowerCase();
    if (!this._MODES.includes(this._mode)) {
      throw new Error(`RocketChat unsupported mode ${config.mode}: use either livechat or private`);
    }

    console.debug('Initializing communication with Rocket Chat...');

    this._backendUrl = config.backendUrl;
    this._initData = config.initData;
    let self = this;
    let clientConfig = {
      deviceId: self._deviceId,
      backendUrl: self._backendUrl,
      username: self._initData.username,
      password: self._initData.password,
      mode: self._mode,
      roomId: self._initData.data.roomId,
      eventBus: self._eventBus
    };

    return new Promise(function (resolve, reject) {
      self._client = new RocketChat(clientConfig);

      self._client.init()
      .then(response => {
        if (response.ok) {
          // both rest api and realtime api are succesfully authenticated, given user and password are correct
          resolve(response);
        } else {
          // some error ocurred
          console.error('Error initializing communication with Rocket Chat:', response.error);
          reject(`Error initializing communication with Rocket Chat: ${response.error}`);
        }
      })
      .catch(error => {
        console.error('Error initializing communication with Rocket Chat:', error);
        reject(error.message);
      });
    });
  }

  send(data) {
    this._client.postMessage(data);
  }

  on(event, callback) {
    this._eventBus.on(event, callback);
  }

  requestOlderMessages(data) {
    var self = this;

    // data = {
    //   deviceId: _deviceId,
    //   id: id of first already visible message,
    //   time: time of first already visible message
    // }
    //
    var lastTime = data === undefined ? Date.now() : data.time;

    return self._client.getOlderMessages(lastTime);
  }
}
