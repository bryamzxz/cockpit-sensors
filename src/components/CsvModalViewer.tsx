import React from 'react';
import {
    Modal,
    ModalVariant,
    Button,
    CodeBlock,
    CodeBlockCode,
    Tooltip,
} from '@patternfly/react-core';
import { ClipboardIcon, DownloadIcon } from '@patternfly/react-icons';
import { _ } from '../utils/cockpit';
import './CsvModalViewer.scss';

type Props = {
    isOpen: boolean;
    text: string;
    filename: string;
    onClose: () => void;
    onRetryDownload?: () => void;
};

export const CsvModalViewer: React.FC<Props> = ({
    isOpen,
    text,
    filename,
    onClose,
    onRetryDownload,
}) => {
    const filenameId = React.useId();

    const handleCopy = React.useCallback(() => {
        navigator.clipboard?.writeText(text).catch(() => {
            // Silencioso: algunos navegadores requieren gesto del usuario.
        });
    }, [text]);

    return (
        <Modal
            className="csv-modal"
            variant={ModalVariant.large}
            isOpen={isOpen}
            onClose={onClose}
            title={_(`Export CSV`)}
            aria-label={_(`CSV preview`)}
            aria-describedby={filename ? filenameId : undefined}
        >
            <div className="csv-modal__body">
                {filename && (
                    <p id={filenameId} className="csv-modal__filename">
                        {filename}
                    </p>
                )}
                <CodeBlock>
                    <CodeBlockCode aria-label={_(`CSV content`)}>{text}</CodeBlockCode>
                </CodeBlock>
            </div>
            <div className="csv-modal__actions">
                <Tooltip content={_(`Copy to clipboard`)}>
                    <Button variant="secondary" onClick={handleCopy} icon={<ClipboardIcon />}>
                        {_(`Copy`)}
                    </Button>
                </Tooltip>
                {onRetryDownload && (
                    <Tooltip content={_(`Try download again`)}>
                        <Button variant="primary" onClick={onRetryDownload} icon={<DownloadIcon />}>
                            {_(`Download`)}
                        </Button>
                    </Tooltip>
                )}
                <Button variant="link" onClick={onClose}>
                    {_(`Close`)}
                </Button>
            </div>
        </Modal>
    );
};
