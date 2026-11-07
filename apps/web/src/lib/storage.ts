// Display-only references. This module never reads or modifies external files.
export const storageLocations: readonly (readonly [string,string,string])[] = [
 ["copy.application",process.env.NEXT_PUBLIC_STORAGE_APP_PATH??'./',"copy.activeApplicationAndLocalDatabase"],
 ["copy.vaults",process.env.NEXT_PUBLIC_STORAGE_VAULT_PATH??'./private/vaults',"copy.reservedAccessDisabled"],
 ["copy.media",process.env.NEXT_PUBLIC_STORAGE_MEDIA_PATH??'./private/media',"copy.reservedAccessDisabled"],
 ["copy.backups",process.env.NEXT_PUBLIC_STORAGE_BACKUP_PATH??'./private/backups',"copy.reservedAutomaticBackupsDisabled"]
];
