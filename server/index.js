const http = require('http')
const express = require('express')
const { Server: SocketServer } = require('socket.io')
var os = require('os')
const fs = require('fs/promises')
const pty = require('node-pty')
const { promises } = require('dns')
const path = require('path')
const cors = require('cors')

const chokidar = require('chokidar');
const ptyProcess = pty.spawn('bash', [], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.env.INIT_CWD + '/user',
  env: process.env
})

const app = express()
const server = http.createServer(app)
const io = new SocketServer({
  cors: '*'
})

app.use(cors());

io.attach(server)

chokidar.watch('./user').on('all',(event,path) =>{
  io.emit('file:refresh',path)
});

ptyProcess.onData(data => {
  io.emit('terminal:data', data)
})

io.on('connection', (socket) => {
  console.log('Socket connected', socket.id)
  socket.on('terminal:write', (data) => {
    ptyProcess.write(data)
  })
})

app.get('/files', async (req, res) => {
  const fileTree = await generateFileTree('./user');
  return res.json({tree: fileTree})

})

server.listen(9000, () => {
  console.log('Docker Server listening on port 9000')

})

async function generateFileTree(directory) {
  const tree = {}
  //tree[asset]={}
  // tree = {assets:{react.svg},component:{terminal.jsx},App.cs:NULL,App.jsx:NULL,index.css:NULL,main.jsx:NULL}
  async function buildTree(currentDir,currentTree){
    const files = await fs.readdir(currentDir);

    for (const file of files){
      const filePath = path.join(currentDir,file)
      const stat = await fs.stat(filePath)

      if(stat.isDirectory()){
        currentTree[file] = {}
        await buildTree(filePath,currentTree[file])
      }
      else{
        currentTree[file] = null
      }
    }
  }
  await buildTree(directory,tree)
  return tree
}