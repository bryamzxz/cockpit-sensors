import React from 'react';
import {
    Button,
    CodeBlock,
    CodeBlockCode,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    ModalVariant,
    Tooltip,
} from '@patternfly/react-core';
import { ClipboardIcon, DownloadIcon } from '@patternfly/react-icons';
import { _ } from '../utils/cockpit';

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
    const titleId = React.useId();
    const descriptionId = React.useId();

    const handleCopy = React.useCallback(() => {
        navigator.clipboard?.writeText(text).catch(() => {
            /* Silent: some browsers require a user gesture */
        });
    }, [text]);

    return (
        <Modal
            className="csv-modal"
            variant={ModalVariant.large}
            isOpen={isOpen}
            onClose={onClose}
            aria-labelledby={titleId}
            aria-describedby={filename ? descriptionId : undefined}
        >
            <ModalHeader
                title={_('Export CSV')}
                labelId={titleId}
                description={filename ? (
                    <span id={descriptionId} className="csv-modal__filename">
                        {filename}
                    </span>
                ) : undefined}
                descriptorId={filename ? descriptionId : undefined}
            />
            <ModalBody>
                <div className="csv-modal__code-wrapper">
                    <CodeBlock>
                        <CodeBlockCode aria-label={_('CSV content')}>{text}</CodeBlockCode>
                    </CodeBlock>
                </div>
            </ModalBody>
            <ModalFooter>
                <Tooltip content={_('Copy to clipboard')}>
                    <Button variant="secondary" onClick={handleCopy} icon={<ClipboardIcon />}>
                        {_('Copy')}
                    </Button>
                </Tooltip>
                {onRetryDownload && (
                    <Tooltip content={_('Try download again')}>
                        <Button variant="primary" onClick={onRetryDownload} icon={<DownloadIcon />}>
                            {_('Download')}
                        </Button>
                    </Tooltip>
                )}
                <Button variant="link" onClick={onClose}>
                    {_('Close')}
                </Button>
            </ModalFooter>
        </Modal>
    );
};
