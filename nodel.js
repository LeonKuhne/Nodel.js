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
    this.group = {
      name: null,
      collapsed: false,
      ends: [],
    }

    this.children = {}
    this.parents = {}
  }
  isLeaf() {
    return Object.values(this.children)?.length == 0
  }
  isHead() {
    return Object.values(this.parents)?.length == 0
  }
  isGroup() {
    return !!this.group.ends.length
  }
  groupAllChildren(nodes) {
    this.group.ends = this.getLeaves(nodes)
  }
  parentGroupNodes(nodes) {
    // get the closest group in parents
    let groups = []
    for (const [connectionType, parents] of Object.entries(this.parents)) {
      for (const parentId of parents) {
        const parentNode = nodes[parentId]

        if (parentNode.isGroup()) {
          // base case
          groups.push(parentNode.id)

        } else {
          // recurse
          groups = groups.concat(parentNode.parentGroupNodes(nodes))
        }
      }
    }
    return groups
  }
  hasChild(nodes, id, end=null) {
    if (this.id === id) {
      return true
    }
    if (this.id === end) {
      return false
    }

    for (const [connectionType, children] of Object.entries(this.children)) {
      for (const childId of children) {
        const child = nodes[childId]
        if (child.hasChild(nodes, id, end)) {
          return true
        }
      }
    }

    return false
  }
  groupContains(nodes, id) {
    for (const end of this.group.ends) {
      if (this.hasChild(nodes, id, end)) {
        return true
      }
    }
    return false
  }
  isVisible(nodes) {
    const parentGroups = this.parentGroupNodes(nodes)
    for (const nodeId of parentGroups) {
      const node = nodes[nodeId]
      if (node.groupContains(nodes, this.id)) {
        return !node.group.collapsed
      }
    }

    return true

    /*
    // recursively check if all parents are collapsed (or ungrouped),
    // up until you find no head, or you reach the end of a group
    for (const [connectionType, parents] of Object.entries(this.parents)) {
      for (const parentId of parents) {
        const parentNode = nodes[parentId]

        // group is collapsed (or ungrouped)
        if (parentNode.group.collapsed) {
          if (parentNode.group.ends.includes(this.id)) {
            return false
          }
        }

        // recurse
        return parentNode.isVisible(nodes)
      }
    }

    // there are no parents, this must be a head
    return true
    */
  }
  getLeaves(nodes, visited=[]) {
    // visit
    if (visited.includes(this.id)) {
      return null
    } else {
      visited.push(this.id)
    }

    // base case
    if (this.isLeaf()) {
      return [this.id]
    }

    // recurse
    let leaves = []
    for (const [connectionType, children] of Object.entries(this.children)) {
      for (const childId of children) {
        const childNode = nodes[childId]
        leaves = leaves.concat(childNode.getLeaves(nodes, visited))
      }
    }
    return leaves
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
  verify(id, exists=true) {
    // by default, returns true if id exists
    if (id && (id in this.nodes) === exists) {
      return true
    }
  
    console.warn(`(nodel) ${!exists ? "found" : "couldn't find"} #${id}`)
    return false
  }
  // api
  addNode(templateId, x, y, data) {
    if (this.render.verify(templateId)) {
      const id = uniqueId()
      this.nodes[id] = new Nodel(id, templateId, x, y, data)
      this.render.draw(this.nodes)
      return id
    }
  }
  createGroup(id, name) {
    if (this.verify(id)) {
      const node = this.nodes[id]
      node.group.name = name
      // NOTE this will create the group up to the nodes leaves
      node.groupAllChildren(this.nodes)
      this.render.draw(this.nodes)
    }
  }
  toggleGroup(id) {
    if (this.verify(id)) {
      const node = this.nodes[id]

      // create the group if none exist
      if (!node.group.ends.length) {
        this.createGroup(id, `${node.data.name} group`)
      }

      node.group.collapsed = !node.group.collapsed
      this.render.draw(this.nodes)
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
      this.verify(parentId) &&
      this.verify(childId) &&
      parentId != childId
    )) {
      return
    }

    // get the nodes to link
    const parentNode = this.nodes[parentId]
    // use the leaf if parent is group and collapsed
    if (parentNode.group.collapsed) {
      const leaves = parentNode.getLeaves(this.nodes)
      for (const [idx, leafId] of Object.entries(leaves)) {
        // NOTE for now connect all leaves to child
        // TODO use the index as the connection type
        this.toggleConnect(leafId, childId, connectionType)
      }
    } else {
      const childNode = this.nodes[childId]


      let [children, parents] = [parentNode.children, childNode.parents]

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
        console.info('disconnecting', parentId, childId)
      } else {
        // connect
        children[connectionType].push(childId)
        parents[connectionType].push(parentId)
        console.info('connecting', parentId, childId)
      }
    }

    this.render.draw(this.nodes)
  }
  moveNode(id, x, y) {
    if (this.verify(id)) {
      let node = this.nodes[id]
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

    // filter out collapsed nodes
    const visibleNodes = Object.values(nodes).filter(node => {
      const isVisible = node.isVisible(nodes)
      console.log(`${node.id} visible: ${isVisible}`)
      return isVisible
    })
    console.info('visible nodes', visibleNodes)
    // 
    // Draw Nodes
    
    for (const node of visibleNodes) {
      // add the element
      const nodeElem = document.getElementById(node.template).cloneNode(true)
      nodel.appendChild(nodeElem)

      // configure element
      nodeElem.id = node.id
      nodeElem.hidden = false

      // supply variables
      // NOTE: vulnerable to XSS
      let varProps = node.group.collapsed ? node.group : node.data
      for (let [attr, value] of Object.entries(varProps)) {
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
    
    for (const node of visibleNodes) {
      // format the node as a leaf
      const leaves = node.group.collapsed ? node.group.ends : [node.id]

      // link node with the children of its leaves
      for (const [connectionIdx, leafId] of Object.entries(leaves)) {
        // the connectionIdx is the index of the end node, since there could be multiple
        const leaf = nodes[leafId]
          
        for (const [connectionType, children] of Object.entries(leaf.children)) {
          for (const childId of children) {
            const child = nodes[childId]
            // filter out non visible nodes
            if (visibleNodes.includes(child)) {
              this.drawConnection(node.id, child.id)
            }
          }
        }
      }
    }
  }
  drawConnection(fromId, toId) {
    console.log(`drawing from ${fromId} to ${toId}`)
    // TODO indicate the connectionId somewhere

    const fromElem = document.getElementById(fromId)
    const toElem = document.getElementById(toId)

    // draw a line to the child
    this.pencil.connect({
      source: fromElem,
      target: toElem,
      anchor: 'Continuous',
      overlays: ["Arrow"]
    })
    this.pencil.setDraggable(fromElem, false)
    this.pencil.setDraggable(toElem, false)
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
