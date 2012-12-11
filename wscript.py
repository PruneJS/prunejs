def default(context):
    # base = context.Node("./")
    build_main(context)


def build_main(context):
    base = context.Node("./src/")

    # order is important. consumer is on the bottom.
    modules = [
        ['./libs/esprima','esprima']
        , ['./libs/argsparser', 'argsparser']
        , 'main.parser'
        , 'main.asttools'
        , 'main.optimizer'
        , 'main.generator'
        , 'main.toposort'
        , 'main.amd'

        # these tie all the above together and should almost always be last.
        , 'main.commands'
        , 'main.processor'
        , 'main.runAsMain'
        , 'main'
    ]
    body = [
        get_escodegen(context)
        , get_esmangle(context)
        , generate_body(context, base, modules)
    ]

    file_wrapper = context.Node('./src/template_cjs_lite.js').text
    context.Node('./prune.js').text = file_wrapper % "\n\n".join(body)


def get_escodegen(context):
    base = context.Node("./src/libs/escodegen/")

    # order is important. consumer is on the bottom.
    modules = [
        './array-set'
        , './util'
        , './base64'
        , './base64-vlq'
        , './source-map-generator'
        , 'source-map'
        , 'escodegen'
    ]

    return generate_body(context, base, modules)


def get_esmangle(context):
    base = context.Node("./src/libs/esmangle/")

    # order is important. consumer is on the bottom.
    modules = [
        'estraverse',
        'escope',

        ['./common', '../common'],
        ['./evaluator', '../evaluator'],

        './pass/hoist-variable-to-arguments',
        './pass/transform-dynamic-to-static-property-access',
        './pass/transform-dynamic-to-static-property-definition',
        './pass/transform-immediate-function-call',
        './pass/transform-logical-association',
        './pass/reordering-function-declarations',
        './pass/remove-unused-label',
        './pass/remove-empty-statement',
        './pass/remove-wasted-blocks',
        './pass/transform-to-compound-assignment',
        './pass/transform-to-sequence-expression',
        './pass/transform-branch-to-expression',
        './pass/transform-typeof-undefined',
        './pass/reduce-sequence-expression',
        './pass/reduce-branch-jump',
        './pass/reduce-multiple-if-statements',
        './pass/dead-code-elimination',
        './pass/remove-side-effect-free-expressions',
        './pass/remove-context-sensitive-expressions',
        './pass/tree-based-constant-folding',
        './pass/drop-variable-definition',
        './pass/remove-unreachable-branch',

        './post/transform-static-to-dynamic-property-access',
        './post/transform-infinity',
        './post/rewrite-boolean',
        './post/rewrite-conditional-expression',

        './annotate-directive',
        'esmangle'
    ]

    return generate_body(context, base, modules)


def generate_body(context, base, modules):

    module_wrapper = context.Node('./src/template_cjs_module_wrapper.js').text
    alias_wrapper = context.Node('./src/template_cjs_module_alias_wrapper.js').text
    body = []
    for module_name in modules:

        # we support aliases for given modules
        aliases = []
        if type(module_name) == list:
            aliases = module_name
            module_name = aliases.pop(0)

        body.append(
            module_wrapper % (
                module_name.replace("./", "")
                , (base + module_name + '.js').text
                , module_name
            )
        )
        print("Appended module '%s'" % module_name)

        # this sets up code to create aliases
        for alias in aliases:
            body.append(
                alias_wrapper % (
                    module_name.replace("./", "")
                    , alias
                    , module_name
                )
            )
            print("Appended module alias '%s' for '%s'" % (alias, module_name))

    # file_wrapper = context.Node('./src/template_cjs_lite.js').text
    # context.Node('./libs/escodegen.js').text = file_wrapper % "\n\n".join(body)
    return "\n\n".join(body)
