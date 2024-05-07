const meta: { [key: string]: any } = {}
const arrayBuffer: ArrayBuffer[] = []
self.onmessage = (ev) => {
  const { data } = ev
  if (data === 'EOF') {
    console.log('EOF from worker')
    const blob = new Blob(arrayBuffer)
    const url = URL.createObjectURL(blob)
    arrayBuffer.length = 0
    self.postMessage(url)
  } else {
    arrayBuffer.push(data)
  }
}
