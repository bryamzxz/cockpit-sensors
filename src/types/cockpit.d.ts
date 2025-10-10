export type CockpitGettext = (message: string) => string;

export interface CockpitSpawnError {
    problem?: string;
    message?: string;
    exit_status?: number;
}

export interface CockpitSpawnProcess {
    stream(callback: (data: string) => void): CockpitSpawnProcess;
    done(callback: (data: string) => void): CockpitSpawnProcess;
    fail(callback: (error: CockpitSpawnError) => void): CockpitSpawnProcess;
    cancel(): void;
    then<TResult1 = string, TResult2 = never>(
        onfulfilled?: ((value: string) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: CockpitSpawnError) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2>;
    catch<TResult = never>(
        onrejected?: ((reason: CockpitSpawnError) => TResult | PromiseLike<TResult>) | null,
    ): Promise<string | TResult>;
}

export interface CockpitFileHandle {
    read(): Promise<string>;
    watch(callback: (content: string | null) => void): () => void;
    close(): void;
}

export interface CockpitSpawnOptions {
    superuser?: 'try' | 'require' | 'never';
    environ?: Record<string, string>;
    err?: 'ignore' | 'message' | 'out';
    binary?: boolean;
}

export interface CockpitFileOptions {
    superuser?: 'try' | 'require' | 'never';
    binary?: boolean;
}

export interface Cockpit {
    gettext: CockpitGettext;
    spawn(command: string[] | string, options?: CockpitSpawnOptions): CockpitSpawnProcess;
    file(path: string, options?: CockpitFileOptions): CockpitFileHandle;
}

declare global {
    const cockpit: Cockpit;
}

export {};
