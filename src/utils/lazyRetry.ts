import { ComponentType, lazy, LazyExoticComponent } from 'react';

/**
 * A retry wrapper for React.lazy that attempts to reload the page once if imports fail.
 * This is useful for handling ChunkLoadErrors that occur after deployments when old chunks are no longer available.
 */
export const lazyRetry = <T extends ComponentType<any>>(
    componentImport: () => Promise<{ default: T }>,
    name: string = 'unknown-component'
): LazyExoticComponent<T> => {
    return lazy(async () => {
        const pageHasAlreadyBeenForceRefreshed = JSON.parse(
            window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
        );

        try {
            const component = await componentImport();
            window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
            return component;
        } catch (error: any) {
            if (!pageHasAlreadyBeenForceRefreshed) {
                // Assuming that the user is not on the latest version of the application.
                // Let's refresh the page immediately.
                console.error(`Attempting to reload page to handle chunk load failure for ${name}`);
                window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
                window.location.reload();

                // Return a never-resolving promise to wait for the page reload
                return new Promise(() => { });
            }

            // If we've already reloaded, throw the error
            console.error(`Failed to load component ${name} even after reload`, error);
            throw error;
        }
    });
};
