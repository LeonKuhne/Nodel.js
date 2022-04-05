poodle noodle v:0.1


# idea
Clicking on the connections changes the function parameter type, aka the 'connectionType'

nodel
- add on connection click callback event to nodel listener
- setConnectionType(nodeA, nodeB, type): if connected: ... proceed
- use parameter index as the connection type
- setConnectionColors(map): map associates 'connection types' (ie param indices) with color values (that jsplumb supports)
- have drawConnection() draw from the connection type-color map

f
- add nodeRender as a param when constructing nodel listener
- look at what I did above with nodel
