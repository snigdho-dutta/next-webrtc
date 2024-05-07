'use client'
const BYTES_PER_CHUNK = 1200
const META_OF_FILE = 'META'
const START_OF_FILE = 'SOF'
const END_OF_FILE = 'EOF'

const sendFile = async () =>
  new Promise<true>((resolve, reject) => {
    if (!window.peer || !window.file) return
    const dataChannel = window.peer.getDataChannel()
    const file = window.file
    if (!dataChannel) return
    const META_DATA = JSON.stringify({
      name: file.name,
      size: file.size,
      type: file.type,
    })
    const fileReader = new FileReader()
    let currentChunk = 0
    try {
      dataChannel.send(META_OF_FILE)
      dataChannel.send(META_DATA)
      dataChannel.send(START_OF_FILE)
      fileReader.onload = () => {
        dataChannel.send(fileReader.result as ArrayBuffer)
        currentChunk++
        if (BYTES_PER_CHUNK * currentChunk < file.size) {
          readNextChunk(fileReader, file, currentChunk)
        } else {
          dataChannel.send(END_OF_FILE)
          resolve(true)
        }
      }
      readNextChunk(fileReader, file, currentChunk)
    } catch (err) {
      reject(err)
    }
  })

function readNextChunk(
  fileReader: FileReader,
  file: File,
  currentChunk: number
) {
  console.log('readNextChunk', currentChunk)
  var start = BYTES_PER_CHUNK * currentChunk
  var end = Math.min(file.size, start + BYTES_PER_CHUNK)
  fileReader.readAsArrayBuffer(file.slice(start, end))
}

self.onmessage = (ev) => {
  console.log(ev.data)
  if (ev.data.type === 'init') {
    console.log('worker init')
    sendFile()
      .then(() => {
        self.postMessage('done')
      })
      .catch((err) => {
        self.postMessage('error')
      })
  }
}
