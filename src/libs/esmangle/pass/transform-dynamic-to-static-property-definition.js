/*
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>

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

/*jslint bitwise:true */
/*global esmangle:true, module:true, define:true, require:true*/
(function () {
    'use strict';

    var Syntax, common, modified;

    common = require('../common');
    Syntax = common.Syntax;

    function transformDynamicToStaticPropertyDefinition(tree, options) {
        var result;

        if (options == null) {
            options = { destructive: false };
        }

        result = (options.destructive) ? tree : common.deepCopy(tree);
        modified = false;

        common.traverse(result, {
            enter: function enter(node) {
                var property, generated;
                if (node.type === Syntax.Property) {
                    if (node.key.type === Syntax.Literal && typeof node.key.value === 'string') {
                        if (common.isIdentifier(node.key.value)) {
                            modified = true;
                            node.key = common.moveLocation(node.key, {
                                type: Syntax.Identifier,
                                name: node.key.value
                            });
                        } else if (node.key.value === Number(node.key.value).toString()) {
                            // we should not generate
                            // var obj = {
                            //   -20: 20
                            // };
                            generated = common.SpecialNode.generateFromValue(Number(node.key.value));
                            if (generated.type === Syntax.Literal) {
                                modified = true;
                                node.key = common.moveLocation(node.key, generated);
                            }
                        }
                    }
                }
            }
        });

        return {
            result: result,
            modified: modified
        };
    }

    transformDynamicToStaticPropertyDefinition.passName = 'transform-dynamic-to-static-property-definition';
    module.exports = transformDynamicToStaticPropertyDefinition;
}());
/* vim: set sw=4 ts=4 et tw=80 : */
