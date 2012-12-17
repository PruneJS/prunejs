/*
  Copyright (C) 2012 Daniel Dotsenko <dotsa@hotmail.com>
  Copyright (C) 2012 Ariya Hidayat <ariya.hidayat@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/


/**
Traverses AST Node tree, calling visitor function upon each node's {node:node, parent:parent_obj} object

@function
@public
@param {Type} Explanation
@returns {Type}
*/
function traverse(node, visitor, parent) {
    // AST spec has no way to comminicate parental relationship up from a given node.
    // Here 'parent' is constantly-redefined-at-each-level nested object
    // in that object there are always 2 keys
    // node - ref to actual AST node object and
    // parent - ref to another {parent:o, node:o} object describing this node's parent.

    // Examples:
    // Getting from us to our parent node:
    //   us.parent.node
    // Getting from us to our parent's parent Node:
    //   us.parent.parent.node
    // Getting from us to our grand-grand-parent (father of father of our father) Node:
    //   us.parent.parent.parent.node

    // parent of root object is normally left undefined.
    // yes, this feels a lot like DOM elements' parent property works.

    var us = {'node':node, 'parent':parent}

    if (visitor(us) === false) {
      return;
    }

    // Note to self:
    // Node.js seems to have a recursion limit of about 10k calls by default
    // With the depths of nodes in AST, hittiing that is actually quite possible
    // on relatively large projects.
    // Crossing fingers, hoping noone complains about that.
    // Will consider switching to stateful, stackless traverser if someone complains.
    // ddotsenko

    var key, child
    for (key in node) {
        if (node.hasOwnProperty(key)) {
            child = node[key];
            if (typeof child === 'object' && child !== null) {
                traverse(child, visitor, us);
            }
        }
    }
}

/**
findAllWorker's little helper. We check if collection object is
a superset of template object.

isSubsetOf( {'a':2}, {'a':2,'b':1} ) === true
isSubsetOf( {'a':4}, {'a':2} ) === false

There is one special case. If value is undefined, any value will do as long as the prop is there:
isSubsetOf( {'a':undefined}, {'a':5} ) === true

We traverse deeper too:
isSubsetOf( {'a':{'b':1}}, {'a':{'b':5}} ) === false

@function
@public
@param {Object} Object with properties that need to exist on collection for a match
@param {Object} Object to be tested as a super-set of template.
@returns {Boolean} true for "all props in template matched those in collection", false otherwise.
*/
function isSubsetOf(template, collection){

  // we are not done until all props in template are matched
  // single mismatch anywhere in the chain = we return with "false".

  var value
  for (var key in template){
    if (template.hasOwnProperty(key)) {

      value = template[key]

      if (typeof value === 'object' && value !== null) {
        if (! isSubsetOf(value, collection[key] || {}) ) {
          return false
        }
      } else if (value === undefined) {
        if (!collection.hasOwnProperty(key)){
          return false
        }
      } else if (value != collection[key]){
        // not !== intentionally, hoping to be more flexible on the match side.
        return false
      }

    }
  }

  return true

}

/**
"Visitor" Node Hahdler for AST traverse function.
Funciton is applied to each Node in the tree.

This one is tuned for applying a set of conditions to a given AST node
and calling a callback with that node and parent when conditions are met.

This function is designed to be bound so that first 2 arguments
- `conditions` and `callback` - are preset and the bound fn is
passed to the traverse() function, where it gets only `element` argument passed.

`conditions` is an array of arrays of objects. Outter array is logical "OR" list of
conditions. Inner arrays are logical "AND" conditions.

For a given "OR" element all objects in the contained "AND" array must match the element
for us to signal a match.

Example `conditions` array:
[
  [
    {'type':'MyType'}
    , // AND
    {'arguments':{'type':'Array'}}
  ]
  , // OR
  [
    {'type':'MyType'}
    , // AND
    {'arguments':{'type':'Object'}}
  ]
]

@function
@param {Array} conditions An array of arrays of objects describing what the object must look like to be selected.
@param {Function} callback Fn to call when conditions are met for a given AST node.
@param {Object} element a {node: AST Node element, parent: similar element but for parent node} object
@returns {Boolean} true for "continue to dig deeper" and false for "no need to look deeper, next node please"
*/
function findAllWorker(conditions, callback, element){

  // [].every() loops over each element until end of array or handler returns false
  // Our outter loop ABUSES that to cut the loop short when first condition group among "OR"
  // is matched to the element. (We return 'false' as an indicator of 'stop looping')
  // Our inner loop actually relies on proper functionality of .every() and relies on
  // return value to figure out if all "AND" conditions vere matched.
  conditions.every(function(andconditions){
    if (andconditions.every(function(condition){
        return isSubsetOf(condition, element)
      })
    ) {
      callback(element)
      return false
    }
    return true
  })

  return true // means "traverser, please continue digging"
}


/**
Traverses the AST tree and finds elements that match particular conditions.

Note, the use of term "elements" and not "nodes"

The traverser in this case wraps each node into an object like this:
{
  "node": ref to actual AST node
  , "parent": object just like this one but for parent of this AST node.
}

AST spec has no notion of "parent" and nodes don't have refs to parents.
Hence this wrapper. See comments for traverse() for more info.

Note, because we have 'parent' linked, you can test node's parent's properties too.

@example

  findAll(
    asttree
    , [
      // first test
      {'node':{
        "type": "CallExpression"
      }}
      // second test
      , {'node':{
        "callee": {
          "type": "Identifier"
          , "name": "require"
        }
      }}
      // second test
      , {'parent':{'node':{
        "type": "SomeExpression"
        }}
      }}
      // all must pass
    ]
  )


@function
@public
@param {Object} asttree The AST tree object
@param {Array} conditions An array of conditions - objects describing how
the tested element should look like.
@returns {Array} with elements matching the conditions.
*/
function findAll(asttree, conditions){
  var answer = []

  traverse(
    asttree
    , findAllWorker.bind(
      this
      , conditions
      , function(element){
        answer.push(element)
      }
    )
  )

  return answer
}

exports.findAll = findAll
exports.isSubsetOf = isSubsetOf
exports.traverse = traverse
