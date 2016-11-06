const MydasWSClient = require('./index.js').Client;
const MydasWSServer = require('./index.js').Server;

var server = new MydasWSServer({ host: "127.0.0.1", port: 9999 });
var client1 = new MydasWSClient({ host: "127.0.0.1", port: 9999 });
var client2 = new MydasWSClient({ host: "127.0.0.1", port: 9999 });

server.on('sayHello', (client, data, callback) => {
  console.log("server.onSayHello", data);
  callback("hello!");
});

client1.on('timetick', (data, callback) => {
  console.log("client1.onTimetick", data);
  callback(data);
});

client2.on('timetick', (data, callback) => {
  console.log("client2.onTimetick", data);
  callback(data);
});

client1.send('sayHello', {
  message: 'hello world!'
}, res => {
  console.log("client1.onSayHelloCallback", res);
});

client1.close();

setInterval(func => {
  server.broadcast('timetick', { timetick: new Date().getTime() }, client => true, (client, res) => {
    console.log("server.onTimetickCallback", res);
  });
}, 1000);
