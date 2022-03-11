'use strict';

// Helpers

function uniqueId() {
  return String(Math.random().toString(16).slice(2))
}

function arrRemove(arr, elem) {
  const idx = arr.indexOf(elem)
  if (idx > -1) {
    arr.splice(idx, 1)
  }
}

function findTemplates() {
  const nodel = document.getElementById('nodel')
  const templates = nodel.children
  const templateIds = []

  for (let idx = 0; idx < templates.length; idx++) {
    const elem = templates[idx]
    templateIds.push(elem.id)
  }

  return templateIds
}

function toRegPos(node) {
  const nodel = document.getElementById('nodel')
  const elemX = node.x + nodel.offsetWidth/2
  const elemY = node.y + nodel.offsetHeight/2
  return [elemX, elemY]
}

// Nodel

class Nodel {
  constructor(id, template, x, y, data) {
    this.id = id
    this.template = template
    this.x = x 
    this.y = y
    this.data = data

    this.children = {}
    this.parents = {}
  }

  isLeaf() {
    return Object.values(this.children)?.length == 0
  }

  isHead() {
    return Object.values(this.parents)?.length == 0
  }
}

class NodelEvent {
  constructor(htmlEvent, node=null) {
    const nodel = document.getElementById('nodel')
    this.x = htmlEvent.x - nodel.offsetWidth/2
    this.y = htmlEvent.y - nodel.offsetHeight/2
    this.node = node
  }
}

class NodelManager {
  constructor(renderEngine) {
    this.nodes = {}
    this.render = renderEngine
  }
  // helpers
  verify(id, exists=false) {
    // by default, returns true if id exists
    if (id && (id in this.nodes) == exists) {
      return true
    }
  
    console.warn(`(nodel) ${!exists ? "found" : "couldn't find"} #${id}`)
    return false
  }
  // api
  addNode(template, x, y, data) {
    if (this.render.verify(template)) {
      const id = uniqueId()
      this.nodes[id] = new Nodel(id, template, x, y, data)
      this.render.draw(this.nodes)
      return id
    }
  }
  deleteNode(id) {
    if (this.verify(id)) {
      delete this.nodes[id]
      this.render.draw(this.nodes)
    }
  }
  toggleConnect(parentId, childId, connectionType='default') {
    // verify both exist
    if (!(
      this.verify(parentId, true) &&
      this.verify(childId, true) &&
      parentId != childId
    )) {
      return
    }

    const parentNode = this.nodes[parentId]
    const childNode = this.nodes[childId]
    var [children, parents] = [parentNode.children, childNode.parents]

    // configure linking
    //
    if (!(connectionType in children)) {
      children[connectionType] = []
    }
    if (!(connectionType in parents)) {
      parents[connectionType] = []
    }
    
    // check if connected
    if (children[connectionType].includes(childId)) {
      // disconnect
      arrRemove(children[connectionType], childId)
      arrRemove(parents[connectionType], parentId)
      console.log('disconnecting', parentId, childId)
    } else {
      // connect
      children[connectionType].push(childId)
      parents[connectionType].push(parentId)
      console.log('connecting', parentId, childId)
    }

    this.render.draw(this.nodes)
  }
  moveNode(id, x, y) {
    if (this.verify(id)) {
      node = this.nodes[id]
      node.x = x
      node.y = y
      this.render.draw(this.nodes)
    }
  }
  getHeads() {
    return Object.values(this.nodes).filter(node => node.isHead())
  }
}

class NodelRender {
  constructor() {
    this.recenter()
    this.resetScale()
    this.templates = findTemplates()

    this.pencil = jsPlumbBrowserUI.newInstance({
        container: document.getElementById('nodel')
    })

    // hide the templates
    this.hideTemplates = false
    this.toggleTemplates()
  }
  toggleTemplates() {
    this.hideTemplates = !this.hideTemplates

    // hide html elements
    for (const template of this.templates) {
      let elem = document.getElementById(template)
      elem.hidden = this.hideTemplates
    }
  }
  // internal
  clear() {
    const nodel = document.getElementById('nodel')

    // reset the lines
    this.pencil.deleteEveryConnection()

    // reset the nodes
    for (let idx = nodel.children.length-1; idx >= 0; idx--) {
      const child = nodel.children[idx]
      if (!this.templates.includes(child.id)) {
        nodel.removeChild(child)
      }
    }
  }
  draw(nodes) {
    const nodel = document.getElementById('nodel')

    // keep templates and remove all other elements
    this.clear()

    // 
    // Draw Nodes
    
    for (const node of Object.values(nodes)) {
      // add the element
      const nodeElem = document.getElementById(node.template).cloneNode(true)
      nodel.appendChild(nodeElem)

      // configure element
      nodeElem.id = node.id
      nodeElem.hidden = false

      // supply variables
      // NOTE: vulnerable to XSS
      for (const [attr, value] of Object.entries(node.data)) {
        nodeElem.innerHTML = nodeElem.innerHTML.replaceAll(`{${attr}}`, value)
      }

      // calculate coordinates
      const [elemX, elemY] = toRegPos(node)

      // set the position
      nodeElem.style.position = 'absolute'
      nodeElem.style.left = `${elemX - nodeElem.offsetHeight/2}px`
      nodeElem.style.top = `${elemY - nodeElem.offsetWidth/2}px`
    }

    //
    // Link Children
    
    for (const [nodeId, node] of Object.entries(nodes)) {
      const nodeElem = document.getElementById(nodeId)

      for (const [connectionType, children] of Object.entries(node.children)) {
        for (const childId of children) {
          const childElem = document.getElementById(childId)

          // draw a line to the child
          this.pencil.connect({
            source: nodeElem,
            target: childElem,
            anchor: 'Continuous',
            overlays: ["Arrow"]
          })
          this.pencil.setDraggable(nodeElem, false)
          this.pencil.setDraggable(childElem, false)
        }
      }
    }
  }
  verify(template, exists=true) {
    if (template && this.templates.includes(template) == exists) {
      return true
    }
  
    console.error(`(nodel) ${!exists ? "found" : "couldn't find"} template #${template}`)
    return false
  }
  // api (pos)
  recenter() {
    self.x = 0
    self.y = 0
  }
  panView(x, y) {
    self.x += x
    self.y += y
  }
  // api (scale)
  adjustScale(delta) {
    this.scale += delta
  }
  setScale(scale) {
  this.scale = scale
  }
  resetScale() {
    this.scale = 1
  }
}

class NodelListener {
  constructor(nodeManager) {
    this.manager = nodeManager
  }
  on(eventType, callback) {
    const nodel = document.getElementById('nodel')

    // use nodels coordinate system
    nodel.addEventListener(eventType, e => {

      // add the node to the event if one selected
      const nodeId = e.target?.id
      let node = null
      if (nodeId && this.manager.verify(nodeId, true)) {
        node = this.manager.nodes[nodeId]
      }

      // create a new 'nodel' event
      const nodelEvent = new NodelEvent(e, node)

      // trigger the event
      callback(nodelEvent)
    })
  }
}
