/*
 * MydasWSClient
 * Version: 1.0.0
 * TODO:
 *   Token 驗證機制
 */

'use strict';
const Client = require('ws');

class MydasWSClient {
  constructor(config) {
    this.config = config;
    this._client = null;
    this._listener = {};
    this._callbacks = {};
    this._queue = "";
    this.connection();
    this.on('callback', this._onCallback.bind(this));
  }

  on(action, fn) {
    if (this._listener[action] === undefined) {
      this._listener[action] = [];
    }
    this._listener[action].push(fn);
  }

  off(action, fn) {
    if (this._listener[action] === undefined) {
      return;
    }
    var index = this._listener[action].indexOf(fn);
    if (index === -1) {
      return;
    }
    this._listener[action].splice(index, 1);
  }

  send(action, data, callbackFunction) {
    var sendArray = [action, data];

    if (callbackFunction) {
      if (this._callbacks[action] === undefined) {
        this._callbacks[action] = [];
      }
      var callbackIndex = this._callbacks[action].indexOf(callbackFunction);
      if (callbackIndex === -1) {
        callbackIndex = this._callbacks[action].push(callbackFunction) - 1;
      }
      sendArray.push(callbackIndex);
    }

    try {
      this._client.send(`${JSON.stringify(sendArray)}\n`);
    } catch (e) {
      this._queue += `${JSON.stringify(sendArray)}\n`;
    }
  }


  connection() {
    this._client = new Client(`ws://${this.config.host}:${this.config.port}`);
    this._client.on('open', this._onOpen.bind(this));
    this._client.on('message', this._onMessage.bind(this));
    this._client.on('error', this._onError.bind(this));
    this._client.on('end', this._onEnd.bind(this));
  }

  close() {
    this._client.close();
  }

  _onOpen() {
    console.log(`MydasWSClient connect to ${this.config.host}:${this.config.port}`);
    if (this._queue !== "") {
      this._client.send(this._queue);
    }
  }

  _onMessage(buffer) {
    buffer.toString().trim().split('\n').forEach(message => {
      if (message === "") return;
      var [action, data, callbackIndex] = JSON.parse(message);
      if (this._listener[action] === undefined) {
        console.log(`MydasWSClient onMessage exception, undefined action ${action}`, data, callbackIndex);
        return;
      }

      this._listener[action].forEach(fn => {
        fn(data, this._callbackClosure(action, callbackIndex).bind(this));
      });
    });
  }

  _callbackClosure(callbackAction, callbackIndex) {
    return function(response) {
      this._callback(callbackAction, callbackIndex, response);
    }.bind(this);
  }

  _callback(callbackAction, callbackIndex, response) {
    this.send('callback', { callbackAction, callbackIndex, response });
  }

  _onError(error) {
    console.log(`MydasWS client onError. `, error);
    this._reconnection();
  }

  _onEnd(end) {
    console.log(`MydasWSClient onEnd. `, end);
    this._reconnection();
  }

  _reconnection() {
    console.log(`MydasWSClient disconnection, reconnect after ${this.config.retryInterval / 1000}`);
    setTimeout(this.connection, this.config.retryInterval);
  }

  _onCallback(data) {
    if (!this._callbacks[data.callbackAction] || !(this._callbacks[data.callbackAction][data.callbackIndex] instanceof Function)) {
      console.log(`MydasWSClient 未知的 callback index: ${data.callbackIndex}, action: ${data.callbackAction}`);
      return;
    }
    this._callbacks[data.callbackAction][data.callbackIndex](data.response);
  }
}

module.exports = MydasWSClient;
