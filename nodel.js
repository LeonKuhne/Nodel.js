
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

class Node {
  constructor(id, template, x, y, data) {
    this.id = id
    this.template = template
    this.x = x 
    this.y = y
    this.data = data

    this.children = {}
    this.parents = {}
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

class NodeManager {
  constructor(renderEngine) {
    this.nodes = {}
    this.render = renderEngine
  }
  // helpers
  verify(id, exists=false) {
    // by default, returns true if id exists
    if ((id in this.nodes) == exists) {
      return true
    }
  
    console.error(`(nodel) ${!exists ? "found" : "couldn't find"} #${id}`)
    return false
  }
  // api
  addNode(template, x, y, data) {
    if (this.render.verify(template)) {
      const id = uniqueId()
      this.nodes[id] = new Node(id, template, x, y, data)
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
    if (!(this.verify(parentId, true) && this.verify(childId, true))) {
      return
    }

    const parentNode = this.nodes[parentId]
    const childNode = this.nodes[childId]
    var [children, parents] = [parentNode.children, parentNode.parents]

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
      console.log('disconnecting')
    } else {
      // connect
      children[connectionType].push(childId)
      parents[connectionType].push(parentId)
      console.log('connecting')
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
}

class NodeRender {
  constructor() {
    this.recenter()
    this.resetScale()
    this.templates = findTemplates()

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
    for (let idx = nodel.children.length-1; idx >= 0; idx--) {
      const child = nodel.children[idx]
      // clear all non template nodes
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
      const nodeElem = document.getElementById(node.template).cloneNode(true)

      // add the element
      nodel.appendChild(nodeElem)
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
    
    const lines = document.getElementById('lines')
    for (const [nodeId, node] of Object.entries(nodes)) {
      const [nodeX, nodeY] = toRegPos(node)

      for (const [connectionType, children] of Object.entries(node.children)) {
        for (const childId of children) {
          // draw an arrow to the child
          const childNode = nodes[childId]
          const [childX, childY] = toRegPos(childNode)

          // draw an svg line from the node to the child
          const line = document.createElementNS('http://www.w3.org/2000/svg','line');
          lines.appendChild(line)
          line.setAttribute('x1', nodeX)
          line.setAttribute('y1', nodeY)
          line.setAttribute('x2', childX)
          line.setAttribute('y2', childY)
          line.setAttribute('stroke', 'black')
          line.classList.add(`line-${connectionType}`)
        }
      }
    }
  }
  verify(template, exists=true) {
    if (this.templates.includes(template) == exists) {
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

class NodeListener {
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
