/** @preserve
Copyright 2012 Daniel Dotsenko dotsa@hotmail.com

License (http://opensource.org/licenses/MIT):
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/**
A class that makes it a bit easier to issue "unique hash/id" to object
instances. Designed to allow "using" Objects as hash keys.

@function
@public
@param {Object} Description
@returns {Type}
*/
function Hasher(){
  var inventory = []
  inventory.getId = function(o){
    var id = this.indexOf(o)
    if (id === -1) {
      return (this.push(o) - 1).toString()
    } else {
      return id.toString()
    }
  }
  return inventory
}

/**
Class allowing one to wrap nodes and their links such that they can be sorted

@function
@public
@param {Object} node Any object that is a center of some links
@param {Array} links A possibly-empty collection of links to the object.
@returns {Object} That looks like {'node':node, 'links':[]}
*/
function Relationship(node, links){
  return {
    'node': node
    , 'links': links || []
  }
}

/**
Tarjan's Strongly Connected Components algorithm
http://en.wikipedia.org/wiki/Tarjan's_strongly_connected_components_algorithm

It is also a reverse topological sort algorythm (for the strongly-connected components)
(As a side-effect of resolving successors of a given node, these
are put on the result array first. This effectively behaves like a topological sort,
but allows 'nodes' in the order chain to be clusters of circular-dependant nodes.
'Reverse' means that you get nodes linked 'to' (listed inside 'links' array) before
you get the node at the center of the relationship.)

The reason this implementation is visibly longer and busier than the pseudo-code is
the 'brokenness' of JavaScript Object key storage. JavaScript object keys must be
strings and every object passed in as key is .toString()'ed. This means no Object
instance can be an Object's key in a meaningful way as .toString()'ed it becomes
'[object Object]' The extra object-to-quasi-id mapping is there to get around the
inability to use object instances as Object keys.

This implementation allows relationships to contain actual Object instances
and returns a reverse topological order array of the actual Object instances.

You also don't need to declare the complete list of all objects mentioned in
all relationships. Only meaningfull relationships (those with links) need to be
passed in the graph object. All linked-to nodes will be autodetected and added
to the topological order array.

@example

  // Notice circular dependency between 'a' and 'c'
  // You don't need to declare empty relationships
  // for link-less objects already mentioned in links
  var graph = [
    new Relationship('a', ['b','c'])
    // , new Relationship('b')
    , new Relationship('c', ['d','a'])
    , new Relationship('d', ['e','f','g'])
    // , new Relationship('e')
    // , new Relationship('f')
    // , new Relationship('g')
    , new Relationship('h', ['j','d'])
    , new Relationship('i', ['a'])
    , new Relationship('j', ['d'])
    , new Relationship('k', ['c'])
    , new Relationship('x')
    , new Relationship('y')
    , new Relationship('z')
  ]

  getSCC(graph) == [["b"],["e"],["f"],["g"],["d"],["c","a"],["j"],["h"],["i"],["k"],["x"],["y"],["z"]]

@function
@public
@param {Array} graph A collection of objects describing the node and its connections
@param {Object} (Optional) propmap A proprty name mapping object used for cases when
  you don't want to rebox your data that is already in {value:o, connections:Array}
  format and just want this code to adapt to your relationship object property name.
  In the example above what you would pass for `propmap` is:
    {
      'node_property_name': 'value'
      , 'links_property_name': 'connections'
    }
  By default the following propmap is assumed:
    {
      'node_property_name': 'node'
      , 'links_property_name': 'links'
    }

@returns {Array} Array of Arrays where outer array is sorted in reverse topological order
  and each inner array is a "strongly-connected component" (one or several nodes with circular
  dependency on each other)
*/
function getSCC(graph, propmap) {

  if (!propmap) {
    propmap = {}
  }
  var npn = propmap['node_property_name'] || 'node'
  var lpn = propmap['links_property_name'] || 'links'

  var index = 0
  var S = [] // stack

  var index_map = {}
  var lowlink_map = {}
  var element_map = {}

  // if nodes are non-literal types, they cannot be keys in Objects.
  // Well, they can, but they all become key name '[object Object]'
  // invetory allows us to "check in" our object, get back unique id
  // that can be used as Object key and do all the sorting on top of the IDs.
  var inventory = new Hasher()
  var answer = []

  function gatherCCNodes(v_id){
    // global: inventory, S
    var w_id, go_on = true, scc = []
    while (go_on && S.length){
      w_id = S.pop()
      scc.push(inventory[w_id])
      go_on = w_id !== v_id
    }
    return scc
  }

  function strongconnect(node, links){
    // E is ({v:NodeObjectA, l:[NodeObjectB,NodeObjectC,NodeObjectD,...]})
    // where value of prop v is node we are inspecting
    // and c is a list of links to/from it.

    // Set the depth index for v to the smallest unused index
    var node_id = inventory.getId(node)
    index_map[node_id] = index
    lowlink_map[node_id] = index
    index = index + 1
    S.push(node_id)

    // Consider successors of v
    links.forEach(function(link){
      var link_id = inventory.getId(link)
      if (index_map[link_id] === undefined){
        // linked node has not yet been visited; recurse on it

        var E = element_map[link_id]
        // above we used a map of declared relationships
        // if a node mentioned in a relationship is not a center of declared
        // relationships (meaning it has no links array of its own)
        // we fudge one
        if (!E) {
          E = {}
          E[npn] = link
          E[lpn] = []
          element_map[link_id] = E
        }

        strongconnect(E[npn], E[lpn])
        lowlink_map[node_id] = Math.min(lowlink_map[node_id], lowlink_map[link_id])
      } else if (S.indexOf(link_id) !== -1){
        // linked node is in stack S and hence in the current SCC
        lowlink_map[node_id] = Math.min(lowlink_map[node_id], index_map[link_id])
      }
    })

    // If v is a root node, pop the stack and generate an SCC
    if (lowlink_map[node_id] === index_map[node_id]){
      answer.push(gatherCCNodes(node_id))
    }
  }

  // strongconnect(E) needs to be able to look up E recursively
  // We must map node ID to E
  graph.forEach(function(E){
    element_map[inventory.getId(E[npn])] = E
  });
  graph.forEach(function(E){
    if (index_map[inventory.getId(E[npn])] === undefined){
      strongconnect(E[npn], E[lpn])
    }
  })

  return answer
}


if (typeof exports !== 'undefined') {
  exports.Relationship = Relationship
  exports.getSCC = getSCC
}

if (
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  require.main === module
  // then we are the main script inside Node.js
) {

  var graph = [
    new Relationship('a', ['b','c'])
    // , new Relationship('b')
    , new Relationship('c', ['d','a'])
    , new Relationship('d', ['e','f','g'])
    // , new Relationship('e')
    // , new Relationship('f')
    // , new Relationship('g')
    , new Relationship('h', ['j','d'])
    , new Relationship('i', ['a'])
    , new Relationship('j', ['d'])
    , new Relationship('k', ['c'])
    , new Relationship('x')
    , new Relationship('y')
    , new Relationship('z')
  ]

  var a = getSCC(
    graph
    // , {
    //   'node_property_name': 'node'
    //   , 'links_property_name': 'links'
    // }
  )

  console.log('strongly connected compoents chain: ', JSON.stringify(a) )
  console.log('you should see this: [["b"],["e"],["f"],["g"],["d"],["c","a"],["j"],["h"],["i"],["k"],["x"],["y"],["z"]]')
  // because the order of ["j"],["h"],["i"],["k"] elements is not important in the graph
  // their order may change depending on your JavaScript engine and the way it orders
  // Object properties and the order you choose when you put relationships into the graph.

}
