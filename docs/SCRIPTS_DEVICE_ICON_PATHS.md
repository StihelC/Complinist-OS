# Device Icon Path Migration Scripts

## ensure-device-icon-paths.js

This script ensures all device types in the database have appropriate SVG icon paths from the `deviceIconMapping.ts` file.

### What it does:

1. Reads all device type to icon path mappings from `src/lib/utils/deviceIconMapping.ts`
2. Queries the database for all devices
3. Updates devices that:
   - Have no `icon_path` set
   - Have old format paths (`src/iconpack/` or `icons/`)
   - Have incorrect icon paths for their device type

### Usage:

```bash
# Use default database location
node scripts/ensure-device-icon-paths.js

# Specify database path
node scripts/ensure-device-icon-paths.js /path/to/complinist.db

# Use environment variable
DB_PATH=/path/to/complinist.db node scripts/ensure-device-icon-paths.js
```

### Database Location:

The script looks for the database in this order:
1. Command line argument
2. `DB_PATH` environment variable
3. Default Electron userData location:
   - Linux: `~/.config/complinist/complinist.db`
   - macOS: `~/Library/Application Support/complinist/complinist.db`
   - Windows: `%APPDATA%/complinist/complinist.db`
4. Local path: `./complinist.db`

### Output:

The script will:
- Show how many device types were found in the mapping
- List devices being updated (first 10)
- Provide a summary:
  - Updated: Number of devices updated
  - Skipped: Devices that already have correct paths
  - Not found: Device types without icon mappings

### Example Output:

```
Database path: /path/to/complinist.db
Extracting device type mappings from deviceIconMapping.ts...
Found 623 device types with icon paths

Querying database for devices...
Found 45 devices in database

Updating device abc123: virtual-machine
  Old: src/iconpack/icons/compute/vm.jpg
  New: src/Icons/Azure/Compute/Virtual-Machine.svg

Summary:
  Updated: 12
  Skipped (already correct): 33
  Not found (no mapping): 0
```

### Notes:

- The script uses transactions for safe updates
- Only devices with valid `device_type` values are processed
- Device types without mappings are reported but not updated
- The script preserves existing correct paths
















