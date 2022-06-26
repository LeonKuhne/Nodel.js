class Nodel {

  // TODO refactor the constructor to take a json object directly
  static fromJSON(obj) {
    return new Nodel(
      obj.id, obj.template, obj.x, obj.y, obj.data,
      obj.parents, obj.children, obj.group
    )
  }

  constructor(id, template, x, y, data,
    parents={}, children={},
    group={
      name: null,
      collapsed: false,
      ends: [],
    },
  ) {
    this.id = id
    this.template = template
    this.x = x 
    this.y = y
    this.data = data
    this.parents = parents
    this.children = children
    this.group = group
  }
  isLeaf() {
    return !Object.values(this.children)?.length
  }
  isHead() {
    return !Object.values(this.parents)?.length
  }
  isGroup(collapsed=null) {
    if (!!this.group.ends.length || this.group.name) {

      // ignore collapsed state
      if (collapsed === null) {
        return true
      }

      // is the collapsed state as expected
      return this.group.collapsed === collapsed
    }

    // not a group
    return false
  }
  groupAllChildren(nodes) {
    this.group.ends = this.getLeaves(nodes)
  }
  parentGroupNodes(nodes, visited=[]) {
    // base case
    if (visited.includes(this.id)) {
      return []
    }
    visited.push(this.id)

    // get the closest group in parents
    let groups = []
    for (const [connectionType, parents] of Object.entries(this.parents)) {
      for (const parentId of parents) {
        const parentNode = nodes[parentId]

        // collect
        if (parentNode.isGroup()) {
          groups.push(parentNode.id)
        }

        // recurse
        groups = groups.concat(parentNode.parentGroupNodes(nodes, visited))
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
  moveConnection(list, id, prevType, newType) {
    // remove the (target) id from the type
    list[prevType].splice(list[prevType].indexOf(id), 1)

    // create the new type if it doesn't exist
    if (!list[newType]) {
      list[newType] = []
    }

    // add the child to the new type
    list[newType].push(id)
  }
  moveParent(parentId, prevType, newType) {
    this.moveConnection(this.parents, parentId, prevType, newType)
  }
  moveChild(childId, prevType, newType) {
    this.moveConnection(this.children, childId, prevType, newType)
  }
  isDirectChild(id, connectionType) {
    return !!this.children[connectionType]?.includes(id)
  }
  groupContains(nodes, id) {
    for (const end of this.group.ends) {
      if (this.hasChild(nodes, id, end)) {
        return true
      }
    }
    return false
  }
  getInvolvedGroupNodes(nodes) {
    // get the groups a node is part of, if any
    const parentGroups = this.parentGroupNodes(nodes)
    const myGroups = []
    for (const nodeId of parentGroups) {
      const node = nodes[nodeId]
      if (node.groupContains(nodes, this.id)) {
        myGroups.push(node)
      }
    }
    return myGroups
  }
  isVisible(nodes) {
    const myGroups = this.getInvolvedGroupNodes(nodes)
    for (const node of myGroups) {
      if (node.group.collapsed) {
        return false
      }
    }
    return true
  }
  getLeaves(nodes, visited=[]) {
    // visit
    if (visited.includes(this.id)) {
      return []
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
  distanceTo(other) {
    return Math.sqrt((this.x - other.x)**2 + (this.y - other.y)**2)
  }
}

