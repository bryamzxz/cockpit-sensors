// Safe text file download that complies with Cockpit's default CSP (no inline scripts)
export function saveTextFile(name: string, data: string, mime = 'text/plain;charset=utf-8'): void {
    try {
        const blob = new Blob([data], { type: mime });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.style.display = 'none';
        anchor.href = url;
        anchor.download = name;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        setTimeout(() => {
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
        }, 0);
    } catch (error) {
        console.error('Failed to save file:', error);
    }
}
