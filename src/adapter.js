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
    //    adminUsername: 'admin',
    //    adminPassword: 'admin',
    //    data: {*appId: YYY} <- fill in with a room id
    // }
    // }

    this._mode = config.mode.toLowerCase();
    if (!this._MODES.includes(this._mode)) {
      throw new Error(`RocketChat unsupported mode ${config.mode}: use either livechat or private`);
    }

    console.debug('Initializing communication with Rocket Chat...');

    this._backendUrl = config.backendUrl;

    // TODO *adapter.init json object to send to backend as initialization result will fire a ChatAdapter::onInit event
    this._initData = config.initData;
    let self = this;

    return new Promise(function (resolve, reject) {
      self._client = new RocketChat(self._backendUrl, self._initData.adminUsername,
          self._initData.adminPassword, self._mode, self._initData.data.appId, self._eventBus);

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
    //   appId: _appId,
    //   deviceId: _deviceId,
    //   id: id of first already visible message,
    //   time: time of first already visible message
    // }
    //
    var lastTime = data === undefined ? Date.now() : data.time;

    return self._client.getOlderMessages(lastTime);
  }
}
