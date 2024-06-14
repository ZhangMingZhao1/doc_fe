import { HocuspocusProvider } from '@hocuspocus/provider';
import { withCursors, withYHistory, withYjs, YjsEditor } from '@slate-yjs/core';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Descendant } from 'slate';
import {
    createEditor,
    Editor,
    Element as SlateElement,
    Transforms
} from 'slate';
import { Slate, withReact, useSlate } from 'slate-react';
import * as Y from 'yjs';
import axios from 'axios';
import { ydoc } from '../../state/ydoc';
import { ConnectionToggle } from '../../components/ConnectionToggle/ConnectionToggle';
import { CustomEditable } from '../../components/CustomEditable/CustomEditable';
import { FormatToolbar } from '../../components/FormatToolbar/FormatToolbar';
import { HOCUSPOCUS_ENDPOINT_URL } from '../../config';
import { withMarkdown } from '../../plugins/withMarkdown';
import { withNormalize } from '../../plugins/withNormalize';
import { randomCursorData } from '../../utils';
import { RemoteCursorOverlay } from './Overlay';
import { Toolbar, Button, Icon } from '../../components/components';
import './index.less';

const TEXT_ALIGN_TYPES = ['left', 'center', 'right', 'justify'];
const LIST_TYPES = ['numbered-list', 'bulleted-list'];

export function RemoteCursorsOverlayPage() {
    const [value, setValue] = useState<Descendant[]>([]);
    const [connected, setConnected] = useState(false);
    const [versionList, setVersionList] = useState<any>([]);

    const createVersion = async () => {
        const time = new Date().getTime();
        const snapshot = Y.snapshot(ydoc);
        const enCodesnapshot = Y.encodeSnapshot(snapshot);
        await axios.post('http://localhost:3000/save', {
            snapshot: enCodesnapshot,
            time
        });
        setVersionList([
            ...versionList,
            { time, snapshot: enCodesnapshot, clientID: ydoc.clientID }
        ]);
    };
    const isMarkActive = (editor, format) => {
        const marks = Editor.marks(editor);
        return marks ? marks[format] === true : false;
    };
    const MarkButton = ({ format, icon }) => {
        const editor = useSlate();
        return (
            <Button
                active={isMarkActive(editor, format)}
                onMouseDown={(event) => {
                    event.preventDefault();
                    toggleMark(editor, format);
                }}
            >
                <Icon>{icon}</Icon>
            </Button>
        );
    };
    const toggleMark = (editor, format) => {
        const isActive = isMarkActive(editor, format);

        if (isActive) {
            Editor.removeMark(editor, format);
        } else {
            Editor.addMark(editor, format, true);
        }
    };
    const provider = useMemo(
        () =>
            new HocuspocusProvider({
                url: HOCUSPOCUS_ENDPOINT_URL,
                name: 'slate-yjs-demo',
                document: ydoc,
                onConnect: () => setConnected(true),
                onDisconnect: () => setConnected(false),
                connect: false
            }),
        []
    );

    const toggleConnection = useCallback(() => {
        if (connected) {
            return provider.disconnect();
        }

        provider.connect();
    }, [provider, connected]);
    const isBlockActive = (editor, format, blockType = 'type') => {
        const { selection } = editor;
        if (!selection) return false;

        const [match] = Array.from(
            Editor.nodes(editor, {
                at: Editor.unhangRange(editor, selection),
                match: (n) =>
                    !Editor.isEditor(n) &&
                    SlateElement.isElement(n) &&
                    n[blockType] === format
            })
        );

        return !!match;
    };
    const toggleBlock = (editor, format) => {
        const isActive = isBlockActive(
            editor,
            format,
            TEXT_ALIGN_TYPES.includes(format) ? 'align' : 'type'
        );
        const isList = LIST_TYPES.includes(format);

        Transforms.unwrapNodes(editor, {
            match: (n) =>
                !Editor.isEditor(n) &&
                SlateElement.isElement(n) &&
                LIST_TYPES.includes(n.type) &&
                !TEXT_ALIGN_TYPES.includes(format),
            split: true
        });
        let newProperties: Partial<SlateElement>;
        if (TEXT_ALIGN_TYPES.includes(format)) {
            newProperties = {
                align: isActive ? undefined : format
            };
        } else {
            newProperties = {
                type: isActive ? 'paragraph' : isList ? 'list-item' : format
            };
        }
        Transforms.setNodes<SlateElement>(editor, newProperties);

        if (!isActive && isList) {
            const block = { type: format, children: [] };
            Transforms.wrapNodes(editor, block);
        }
    };
    const BlockButton = ({ format, icon }) => {
        const editor = useSlate();
        return (
            <Button
                active={isBlockActive(
                    editor,
                    format,
                    TEXT_ALIGN_TYPES.includes(format) ? 'align' : 'type'
                )}
                onMouseDown={(event) => {
                    event.preventDefault();
                    toggleBlock(editor, format);
                }}
            >
                <Icon>{icon}</Icon>
            </Button>
        );
    };
    const editor = useMemo(() => {
        const sharedType = provider.document.get(
            'content',
            Y.XmlText
        ) as Y.XmlText;

        return withMarkdown(
            withNormalize(
                withReact(
                    withYHistory(
                        withCursors(
                            withYjs(createEditor(), sharedType, {
                                autoConnect: false
                            }),
                            provider.awareness,
                            {
                                data: randomCursorData()
                            }
                        )
                    )
                )
            )
        );
    }, [provider.awareness, provider.document]);

    // Connect editor and provider in useEffect to comply with concurrent mode
    // requirements.
    useEffect(() => {
        provider.connect();
        return () => provider.disconnect();
    }, [provider]);
    useEffect(() => {
        YjsEditor.connect(editor);
        return () => YjsEditor.disconnect(editor);
    }, [editor]);
    useEffect(() => {
        async function fetchSnapshots() {
            const { data } = await axios.get(
                'http://localhost:3000/get/snapshots',
                {}
            );
            setVersionList(data);
        }

        fetchSnapshots();
    }, []);
    return (
        <React.Fragment>
            <div className="version-body">
                <div className="create-version" onClick={createVersion}>
                    创建版本
                </div>
                <div className="version-list">
                    {versionList.map((version, index) => {
                        return (
                            <div key={index} className="version-item">
                                {new Date(version.time).toLocaleString()}
                            </div>
                        );
                    })}
                </div>
            </div>
            <Slate value={value} onChange={setValue} editor={editor}>
                <Toolbar>
                    <MarkButton format="bold" icon="format_bold" />
                    <MarkButton format="italic" icon="format_italic" />
                    <MarkButton format="underline" icon="format_underlined" />
                    <MarkButton format="code" icon="code" />
                    <BlockButton format="heading-one" icon="looks_one" />
                    <BlockButton format="heading-two" icon="looks_two" />
                    <BlockButton format="block-quote" icon="format_quote" />
                    <BlockButton
                        format="numbered-list"
                        icon="format_list_numbered"
                    />
                    <BlockButton
                        format="bulleted-list"
                        icon="format_list_bulleted"
                    />
                    <BlockButton format="left" icon="format_align_left" />
                    <BlockButton format="center" icon="format_align_center" />
                    <BlockButton format="right" icon="format_align_right" />
                    <BlockButton format="justify" icon="format_align_justify" />
                </Toolbar>
                <RemoteCursorOverlay className="flex justify-center mt-4 mb-32 mx-10">
                    <FormatToolbar />

                    <CustomEditable className="max-w-4xl w-full flex-col break-words"></CustomEditable>
                </RemoteCursorOverlay>
                <ConnectionToggle
                    connected={connected}
                    onClick={toggleConnection}
                />
            </Slate>
        </React.Fragment>
    );
}
