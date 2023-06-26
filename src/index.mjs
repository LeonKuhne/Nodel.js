import { NodelRender } from './renderer.mjs'
import { NodelManager } from './manager.mjs'
import { NodelListener } from './listener.mjs'

// verify jsplumb has already been loaded
if (typeof jsPlumb === 'undefined') {
  console.error('jsPlumb is not loaded')
  //throw new Error('jsPlumb is not loaded')
}

module.exports = {
  Render: NodelRender,
  Manger: NodelManager,
  Listener: NodelListener,
}