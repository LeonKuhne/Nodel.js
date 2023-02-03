class NodelManager {
  constructor(renderEngine) {
    this.nodes = {}
    this.render = renderEngine
    this.isDrawingPaused = 0
    this.onDrawCallbacks = []
  }
  // helpers
  isEmpty() {
    return !Object.keys(this.nodes).length
  }
  exists(id) {
    return id && (id in this.nodes)
  }
  verify(id, exists=true) {
    // by default, returns true if id exists
    if (this.exists(id) === exists) {
      return true
    }
    
    console.debug(`(nodel) ${!exists ? "found" : "couldn't find"} #${id}`)
    return false
  }
  verifyBoth(idA, idB, exists=true) {
    return this.verify(idA) && this.verify(idB)
  }
  onDraw(callback) {
    this.onDrawCallbacks.push(callback)
  }
  redraw() {
    if (!this.isDrawingPaused) {
      this.render.draw(this.nodes)

      // call on draw callbacks
      for (const callback of this.onDrawCallbacks) {
        callback()
      }
    } else {
      console.warn(`skipping draw request, drawing is paused`)
    }
  }
  pauseDraw() {
    this.isDrawingPaused += 1
    console.debug(`Drawing paused: ${this.isDrawingPaused}`)
  }
  unpauseDraw() {
    console.debug(`Drawing unpaused: ${this.isDrawingPaused}`)
    this.isDrawingPaused -= 1
    if (this.isDrawingPaused < 0) {
      console.error(`Something has gone terribly wrong`)
    }
    this.redraw()
  }

  // api
  addNode(templateId, x, y, data) {
    if (this.render.verify(templateId)) {
      // generate new id
      const id = uniqueId()
      // create and track the node
      this.nodes[id] = new Nodel(id, templateId, x, y, data)
      this.redraw()
      return id
    }
    return null
  }
  createGroup(id, name) {
    if (this.verify(id)) {
      const node = this.nodes[id]
      node.group.name = name
      // NOTE this will create the group up to the nodes leaves
      node.groupAllChildren(this.nodes)
      this.redraw()
    }
  }
  toggleGroup(id, collapsed=null) {
    if (this.verify(id)) {
      const node = this.nodes[id]

      // create the group if none exist
      if (!node.group.ends.length) {
        this.createGroup(id, `${node.data.name} group`)
      }

      node.group.collapsed = (collapsed == null) ? !node.group.collapsed : collapsed
      this.redraw()
    }
  }
  deleteNode(id) {
    if (this.verify(id)) {
      const node = this.nodes[id]
      // delete the node
      delete this.nodes[id]
      // delete the  childs parent reference
      this.eachChild(node, child => {
        for (const [connectionType, parents] of Object.entries(child.parents)) {
          if (node.id in parents) {
            child.parents[connectionType].splice(parents.indexOf(node.id), 1)
          }
        }
      })
      // delete the parents child reference
      this.eachParent(parent, childsParent => {
        for (const [connectionType, children] of Object.entries(parent.children)) {
          if (node.id in children) {
            parent.children[connectionType].splice(children.indexOf(node.id), 1)
          }
        }
      })
      this.redraw()
    }
  }
  toggleConnect(parentId, childId, connectionType='default') {
    if (!this.verifyBoth(parentId, childId)) {
      return
    }

    // get the nodes to link
    const parentNode = this.nodes[parentId]

    // handle groups
    if (parentNode.group.collapsed) {
      // parentNode must be a group, use its ends instead
      for (const endId of parentNode.group.ends) {
        this.toggleConnect(endId, childId, connectionType)
        return
      }
    } 

    // toggle connected state
    if (parentNode.isDirectChild(childId, connectionType)) {
      this.disconnectNodes(parentId, childId, connectionType)
    } else {
      this.connectNodes(parentId, childId, connectionType)
    }

    this.redraw()
  }
  getConnectionType(parentId, childId) {
    if (!this.verifyBoth(parentId, childId)) {
      return
    }
    
    // find the connection type
    const parentNode = this.nodes[parentId]
    for (const [connectionType, children] of Object.entries(parentNode.children)) {
      if (children.includes(childId)) {
        return connectionType
      }
    }
    return null
  }
  setConnectionType(parentId, childId, type) {
    if (!this.verifyBoth(parentId, childId)) {
      return
    }

    // find the connection type
    const prevType = this.getConnectionType(parentId, childId)
    this.nodes[parentId].moveChild(childId, prevType, type)
    this.nodes[childId].moveParent(parentId, prevType, type)

    this.redraw()
  }
  connectNodes(parentId, childId, connectionType) {
    if (!this.verifyBoth(parentId, childId)) {
      return
    }

    // get connecting children and parents
    const children = this.nodes[parentId].children
    const parents = this.nodes[childId].parents

    // setup
    if (!(connectionType in children)) {
      children[connectionType] = []
    }
    if (!(connectionType in parents)) {
      parents[connectionType] = []
    }

    // connect
    children[connectionType].push(childId)
    parents[connectionType].push(parentId)
    console.debug('Connected', parentId, childId)
  }
  disconnectNodes(parentId, childId, connectionType) {
    // get connecting children and parents
    const children = this.nodes[parentId].children
    const parents = this.nodes[childId].parents

    // disconnect
    arrRemove(children[connectionType], childId)
    arrRemove(parents[connectionType], parentId)
    console.debug('Disconnected', parentId, childId)
  }
  moveNode(id, x, y) {
    if (this.verify(id)) {
      const node = this.nodes[id]
      const deltaX = x - node.x
      const deltaY = y - node.y
      // 

      // update the nodes location
      node.x = x
      node.y = y

      // update the location location
      if (node.isGroup() && node.group.collapsed) {
        // TODO i think you also need to move the child nodes children here, recursively
        this.eachChild(node, (child, connectionType) => {
          child.x += deltaX
          child.y += deltaY
        }, node.group.ends)
      }
      this.redraw()
      console.debug('Moved node to', x, y)
    }
  }
  getHeads() {
    return Object.values(this.nodes).filter(node => node.isHead())
  }
  eachChild(node, callback, until=[]) {
    this.eachConnection(node.children, callback, until)
  }
  eachParent(node, callback, until=[]) {
    this.eachConnection(node.parents, callback, until)
  }
  eachConnection(connectionList, callback, until=[]) {
    if (!connectionList) {
      return
    }
    // callback on each connection
    for (const [connectionType, connection] of Object.entries(connectionList)) {
      for (const nodeId of connection) {
        if (!(nodeId in until)) {
          callback(this.nodes[nodeId], connectionType)
        }
      }
    }
  }
  getDirectNodes(map) {
    const connections = {}
    for (const [connectionType, nodes] of Object.entries(map)) {
      // setup
      if (!(connectionType in connections)) {
        connections[connectionType] = []
      }

      // aggregate 
      for (const childGroupMap of nodes) {
        connections[connectionType].push(childGroupMap.id)
      }
    }
    return connections
  }
  createGroupMap(node, ends=null, originX=0, originY=0) {
    if (!ends) {
      // decendant node
      ends = node.group.ends
    }

    // base case
    if (node.id in ends) {
      return null
    }

    const childrenMap = {}
    for (const [connectionType, children] of Object.entries(node.children)) {
      // setup map
      if (!(connectionType in childrenMap)) {
        childrenMap[connectionType] = []
      }

      // aggregate children
      for (const childId of children) {
        const child = this.nodes[childId]

        // save the map
        const childMap = this.createGroupMap(child, ends, node.x, node.y)
        childrenMap[connectionType].push(childMap)
      }
    }

    return {
      id: node.id,
      moduleId: node.data.name,
      offsetX: node.x - originX,
      offsetY: node.y - originY,
      parents: ends ? node.parents : null,
      children: childrenMap ? childrenMap : null,
    }
  }
  createFromMap(
    map, x, y,
    head=null, createNextHead=()=>null,
    group=null, created={}, connection=null
  ) {
    // find/create the next map head node
    let node = head ?? created[map.id] ?? createNextHead(map, x, y)

    // create if new
    if (!(map.id in created)) {
      created[map.id] = node

      // recursively create nodes in group
      for (const [connectionType, children] of Object.entries(map.children)) {
        for (const childMap of children) {
          this.createFromMap(
            childMap, node.x, node.y,
            null, createNextHead, null, created,
            {
              type: connectionType,
              parentId: node.id,
            }
          )
        }
      }
    }

    // create connections
    const toKey = JSON.stringify
    if (connection) {
      this.connectNodes(connection.parentId, node.id, connection.type)
      node.conn.push(toKey(connection))
    }

    return node.id
  }
  load(nodeList) {
    // recreate the node objects from the list of node objects
    for (const nodeObj of nodeList) {
      this.nodes[nodeObj.id] = Nodel.fromJSON(nodeObj)
    }
    this.redraw()
  }
}
