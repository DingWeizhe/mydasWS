/*
 * MydasWSServer
 * Version: 1.0.0
 * TODO:
 *   Token 驗證機制
 */

'use strict';
const Server = require('ws').Server;

class MydasWSServer {

  constructor(config) {
    this.clients = [];
    this._server = new Server(config);
    this._callbacks = {};
    this._listener = {};
    this._server.on('connection', this._onClientConnection.bind(this));
    this.on('callback', this._onCallback.bind(this));
  }

  on(action, fn) {
    if (this._listener[action] === undefined) {
      this._listener[action] = [];
    }
    this._listener[action].push(fn);
  }

  off(action, fn) {
    if (this._listener === undefined) {
      return;
    }
    var index = this._listener[action].indexOf(fn);
    if (index === -1) {
      return;
    }
    this._listener[action].splice(index, 1);
  }

  broadcast(action, data, filter, callbackFunction) {
    if (filter === undefined) {
      filter = this._defaultFilter;
    }

    this.clients.filter(client => {
      try {
        return filter(client);
      } catch (e) {
        return false;
      }
    }).forEach(client => {
      try {
        client.send(action, data, callbackFunction);
      } catch (e) {
        console.log('MydasWSServer broadcast exception: ', e);
      }
    });
  }

  send(client, action, data, callbackFunction) {
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
      client.proxySend(`${JSON.stringify(sendArray)}\n`);
    } catch (e) {
      var index = this.clients.indexOf(client);
      this.clients.splice(index, 1);
    }
  }

  _defaultFilter(client) {
    return true;
  }

  _onClientConnection(client) {
    console.log(`MydasWSServer client connected`);
    this.clients.push(client);
    client.on('message', this._onMessageClosure(client));
    client.proxySend = client.send;
    client.send = this._sendClosure(client);
  }

  _onMessageClosure(client) {
    return function(buffer) {
      this._onMessage(client, buffer);
    }.bind(this);
  }

  _onMessage(client, buffer) {
    buffer.toString().trim().split('\n').forEach(message => {
      var [action, data, callbackIndex] = JSON.parse(message);
      if (this._listener[action] === undefined) {
        console.log(`MydasWSServer _onMessage exception, undefined action ${action}`, data, callbackIndex);
        return;
      }

      this._listener[action].forEach(func => {
        func(client, data, this._callbackClosure(client, action, callbackIndex));
      });
    });
  }

  _callbackClosure(client, callbackAction, callbackIndex) {
    return function(response) {
      this._callback(client, callbackAction, callbackIndex, response);
    }.bind(this);
  }

  _callback(client, callbackAction, callbackIndex, response) {
    client.send('callback', { callbackAction, callbackIndex, response });
  }

  _sendClosure(client) {
    return function(action, data, fn) {
      this.send(client, action, data, fn);
    }.bind(this);
  }

  _onCallback(client, data) {
    if (!this._callbacks[data.callbackAction] || !(this._callbacks[data.callbackAction][data.callbackIndex] instanceof Function)) {
      console.log(`MydasWSServer 未知的 callback index: ${data.callbackIndex}, action: ${data.callbackAction}`);
      return;
    }
    this._callbacks[data.callbackAction][data.callbackIndex](client, data.response);
  }
}

module.exports = MydasWSServer;
