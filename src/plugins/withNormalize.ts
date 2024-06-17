import { Editor, Transforms } from 'slate';

export function withNormalize(editor: Editor) {
    const { normalizeNode } = editor;

    // Ensure editor always has at least one child.
    editor.normalizeNode = (entry) => {
        const [node] = entry;
        console.log(
            '!Editor.isEditor(node) || node.children.length > 0',
            !Editor.isEditor(node) || node.children.length > 0
        );
        if (!Editor.isEditor(node) || node.children.length > 0) {
            return normalizeNode(entry);
        }

        Transforms.insertNodes(
            editor,
            {
                type: 'paragraph',
                children: [{ text: '' }]
            },
            { at: [0] }
        );
    };

    return editor;
}
