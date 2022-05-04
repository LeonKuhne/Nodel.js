class NodelEvent {

  static TYPES = {
    Node: 0,
    Connection: 1,
  }

  constructor(type, htmlEvent, nodes=null) {
    const nodel = document.getElementById('nodel')
    this.elem = htmlEvent.target
    this.x = htmlEvent.x - nodel.offsetWidth/2
    this.y = htmlEvent.y - nodel.offsetHeight/2

    // Event type specific setters
    switch (type) {
      case NodelEvent.TYPES.Node:
        this.node = nodes
        break;
      case NodelEvent.TYPES.Connection:
        this.nodes = nodes
        break;
      default:
        console.error(`Unknown NodelEvent type: ${type}`)
    }
  }
}

