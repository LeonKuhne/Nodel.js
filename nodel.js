
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
  constructor(renderEngine, verbose=false) {
    this.nodes = {}
    this.render = renderEngine
    this.verbose = verbose
  }
  // helpers
  verify(id, exists=false) {
    // by default, returns true if id exists
    if ((id in this.nodes) == exists) {
      return true
    }
  
    if (this.verbose) {
      console.error(`(nodel) ${!exists ? "found" : "couldn't find"} #${id}`)
    }

    return false
  }
  // api
  addNode(template, x, y, data) {
    if (this.render.verify(template)) {
      const id = uniqueId()
      this.nodes[id] = new Node(id, template, x, y, data)
      this.render.draw(Object.values(this.nodes))
      return id
    }
  }
  deleteNode(id) {
    if (this.verify(id)) {
      delete this.nodes[id]
      this.render.draw(Object.values(this.nodes))
    }
  }
  toggleConnect(parentId, childId, connectionType) {
    // verify both exist
    if (!this.verify(parentId) || !this.verify(childId)) {
      return
    }

    parentNode = this.nodes[parentId]
    childNode = this.nodes[childId]

    // configure linking
    if (!(connectionType in parentNode.children)) {
      parentNode[connectionType] = []
    }
    if (!(connectionType in childNode.parents)) {
      childNode[connectionType] = []
    }
    
    // check if connected
    if (childId in parentNode.children[connectionType]) {

      // disconnect
      arrRemove(parentNode.children[connectionType], childId)
      arrRemove(childNode.parents[connectionType], parentId)
    } else {
      // connect
      parentNode.children[connectionType].append(childId)
      childNode.parents[connectionType].append(parentId)
    }

    this.render.draw(Object.values(this.nodes))
  }
  moveNode(id, x, y) {
    if (this.verify(id)) {
      node = this.nodes[id]
      node.x = x
      node.y = y
      this.render.draw(Object.values(this.nodes))
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
      if (!this.templates.includes(child.id)) {
        nodel.removeChild(child)
      }
 }
  }
  draw(nodes) {
    const nodel = document.getElementById('nodel')

    // keep templates and remove all other elements
    this.clear()

    // nodel center
    const centerX = nodel.offsetWidth / 2
    const centerY = nodel.offsetHeight / 2

    // draw nodes from templates
    for (const node of nodes) {
      const template = document.getElementById(node.template)
      const nodeElem = template.cloneNode(true)

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
      const centerElemX = centerX - nodeElem.offsetWidth / 2
      const centerElemY = centerY - nodeElem.offsetHeight / 2
      const elemX = centerElemX + node.x
      const elemY = centerElemY + node.y

      // set the position
      nodeElem.style.position = 'absolute'
      nodeElem.style.left = `${elemX}px`
      nodeElem.style.top = `${elemY}px`

      // link the children
      for (const [id, child] of Object.entries(node.children)) {
        // draw an arrow to the child
        // TODO: use LeaderLine (or some library like it)
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
