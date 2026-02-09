# Device Type Matching System

## Overview

The Device Type Matching system ensures that imported resources (from Terraform, templates, or JSON projects) use the closest matching device types and icons from the CompliNist database rather than falling back to generic defaults.

This system uses **fuzzy matching** with multiple scoring criteria to intelligently map imported device specifications to existing device types in the SQLite database.

---

## Problem Statement

Previously, when importing infrastructure from:
- **Terraform plans** (AWS, Azure resources)
- **Project templates** (JSON exports)
- **External configurations**

CompliNist would:
1. Use hardcoded device type mappings
2. Fall back to generic icons when exact matches weren't found
3. Not leverage the 600+ Azure icons and device types in the database

This resulted in:
- Inconsistent visual representation
- Generic "resource" icons instead of service-specific icons
- Loss of fidelity when importing/exporting projects

---

## Solution Architecture

### 1. Device Type Matcher (`src/lib/utils/deviceTypeMatcher.ts`)

**Client-side TypeScript utility** that implements fuzzy matching logic:

```typescript
export interface DeviceTypeMatchRequest {
  deviceType?: string          // e.g., 'virtual-machine'
  deviceSubtype?: string        // e.g., 'azurerm_virtual_machine'
  category?: string             // e.g., 'Compute'
  resourceType?: string         // e.g., 'aws_instance'
  provider?: string             // e.g., 'aws', 'azurerm'
  iconPath?: string             // Existing icon path to validate
}

export interface DeviceTypeMatchResult {
  matched: boolean              // True if good match found
  deviceType: DeviceType        // Matched device type
  deviceSubtype?: string        // Matched subtype
  iconPath: string              // Path to icon in database
  displayName: string           // Human-readable name
  matchScore: number            // 0.0 - 1.0 confidence score
  matchReason: string           // Explanation of why matched
}
```

**Matching Algorithm:**

1. **Exact Icon Path Match** (score: 1.0)
   - If iconPath provided and exists in DB, use it immediately

2. **Device Type Matching** (up to 50 points)
   - Exact match: 50 points
   - Fuzzy similarity > 70%: 40 points (Levenshtein distance)

3. **Device Subtype Matching** (up to 30 points)
   - Exact match: 30 points
   - Fuzzy similarity > 70%: 20 points

4. **Category Matching** (20 points)
   - Exact category match

5. **Provider Matching** (15 points)
   - Icon path contains correct provider (AWS/Azure)

6. **Keyword Matching** (10 points per keyword)
   - Extract keywords from resource type and display name
   - Match with >80% similarity

7. **Display Name Similarity** (up to 15 points)
   - Overall similarity between display name and device type

**Threshold:** Requires score ≥ 20 for acceptance

**Fallbacks:**
- Category-based fallback (score: 0.3)
- First available type (score: 0.1)

---

### 2. IPC Handlers (`electron/ipc/device-types.js`)

**Main process handlers** for device type matching:

#### `device-types:find-match`
Single device type match request.

```javascript
const matchResult = await window.electronAPI.findDeviceTypeMatch({
  deviceType: 'virtual-machine',
  category: 'Compute',
  resourceType: 'azurerm_virtual_machine',
  provider: 'azurerm',
  iconPath: 'src/Icons/Azure/Compute/Virtual-Machines.svg'
})
```

#### `device-types:batch-find-match`
Batch process multiple match requests (more efficient for imports).

```javascript
const matchResults = await window.electronAPI.batchFindDeviceTypeMatch([
  { deviceType: 'virtual-machine', provider: 'aws', ... },
  { deviceType: 'load-balancers', provider: 'azurerm', ... },
  // ... more requests
])
```

**Implementation Details:**
- Queries `device_types` table from SQLite
- Implements same fuzzy matching logic as TypeScript version
- Returns safe fallbacks on error
- Logs matching decisions for debugging

---

### 3. Terraform Mapper Integration

#### AWS Mapper (`src/lib/terraform/resourceMappers/awsMapper.ts`)

**Before:**
```typescript
mapResource(type: string, attributes: any): ResourceMapping {
  const mapping = AWS_RESOURCE_MAP[type]
  if (!mapping) {
    return { deviceType: 'virtual-machine', iconPath: 'Generic-Resource.svg', ... }
  }
  return { ...mapping }
}
```

**After:**
```typescript
async mapResourceAsync(type: string, attributes: any): Promise<ResourceMapping> {
  const mapping = AWS_RESOURCE_MAP[type]

  if (mapping && window.electronAPI) {
    const matchResult = await window.electronAPI.findDeviceTypeMatch({
      deviceType: mapping.deviceType,
      category: mapping.category,
      resourceType: type,
      provider: 'aws',
      iconPath: mapping.iconPath
    })

    if (matchResult.matched) {
      return {
        deviceType: matchResult.deviceType,
        iconPath: matchResult.iconPath,
        category: mapping.category,
        defaultName: this.extractName(attributes, type)
      }
    }
  }

  return fallback...
}
```

Same pattern applied to **Azure Mapper**.

---

### 4. State Converter Update (`src/lib/terraform/stateConverter.ts`)

**New async function:**

```typescript
export async function convertTerraformPlanToNodesAsync(
  context: ConversionContext
): Promise<ConversionResult> {
  const nodes: TerraformNode[] = []

  for (const resource of context.plan.resource_changes) {
    const mapping = await mapTerraformResourceAsync({
      provider: resource.provider_name,
      resourceType: resource.type,
      resourceAttributes: resource.change.after || {}
    })

    const node = createNodeFromResource(resource, mapping, changeType)
    nodes.push(node)
  }

  return { nodes, edges, boundaries, warnings }
}
```

**Used in Terraform Store:**

```typescript
// src/core/stores/useTerraformStore.ts
loadTerraformPlan: async (jsonString: string) => {
  const plan = parseTerraformPlan(jsonString)
  const dependencies = analyzeDependencies(plan)

  // Use async version with intelligent matching
  const afterState = await convertTerraformPlanToNodesAsync({
    plan,
    resourceMappings: new Map(),
    dependencies,
    layoutStrategy: 'auto'
  })

  // Add to canvas...
}
```

---

### 5. Project/Template Import (`src/lib/utils/deviceTypeImportMatcher.ts`)

**Batch matcher for JSON imports:**

```typescript
export async function matchDeviceTypesForImport(
  nodes: AppNode[]
): Promise<AppNode[]> {
  const matchRequests = nodes
    .filter(node => node.type === 'device')
    .map(node => ({
      deviceType: node.data.deviceType,
      deviceSubtype: node.data.deviceSubtype,
      iconPath: node.data.iconPath,
      category: inferCategoryFromDeviceType(node.data.deviceType)
    }))

  const matchResults = await window.electronAPI.batchFindDeviceTypeMatch(matchRequests)

  return nodes.map((node, i) => {
    if (node.type !== 'device') return node

    const match = matchResults[i]
    if (match.matched && match.matchScore > 0.5) {
      return {
        ...node,
        data: {
          ...node.data,
          deviceType: match.deviceType,
          iconPath: match.iconPath
        }
      }
    }
    return node
  })
}
```

**Used in Flow Store:**

```typescript
// src/core/stores/useFlowStore.ts
importDiagramFromJSON: async () => {
  const result = await importFromJSON()
  const reportData = result.data as FullReport

  // Match device types before restoration
  const { matchDeviceTypesForImport } = await import('@/lib/utils/deviceTypeImportMatcher')
  const matchedNodes = await matchDeviceTypesForImport(reportData.diagram.nodes)

  const validatedNodes = validateAndCleanNodes(matchedNodes)
  set({ nodes: validatedNodes, edges: reportData.diagram.edges })
}
```

---

## Usage Examples

### Example 1: Terraform AWS Import

**Input:** Terraform plan with `aws_instance`

**Static Mapping:**
```javascript
{
  deviceType: 'virtual-machine',
  iconPath: 'src/Icons/Aws/Compute/Amazon-Ec2.svg',
  category: 'Compute'
}
```

**Device Type Matcher:**
1. Queries database for all device types
2. Finds exact match for `Amazon-Ec2.svg`
3. Verifies icon exists in database
4. Returns validated device type

**Result:**
```javascript
{
  matched: true,
  deviceType: 'virtual-machine',
  iconPath: 'src/Icons/Aws/Compute/Amazon-Ec2.svg',
  displayName: 'Amazon EC2',
  matchScore: 1.0,
  matchReason: 'Exact icon path match'
}
```

### Example 2: Unknown Resource Type

**Input:** Terraform plan with `azurerm_custom_resource_provider` (not in static map)

**Static Mapping:** Falls back to generic

**Device Type Matcher:**
1. Extracts keywords: ['custom', 'resource', 'provider']
2. Searches database for similar Azure resources
3. Finds 'Azure Resource Manager' with keywords ['resource', 'manager']
4. Calculates similarity score: 0.65

**Result:**
```javascript
{
  matched: true,
  deviceType: 'resource-groups',
  iconPath: 'src/Icons/Azure/Management/Resource-Groups.svg',
  displayName: 'Resource Groups',
  matchScore: 0.65,
  matchReason: '2 keyword match(es), Azure provider match'
}
```

### Example 3: Template Import

**Input:** Exported project with outdated icon paths

**Before:**
```javascript
{
  deviceType: 'virtual-machine',
  iconPath: 'src/Icons/Azure/old-path/VM-Classic.svg'  // Doesn't exist
}
```

**Device Type Matcher:**
1. Icon path doesn't exist in database
2. Searches for 'virtual-machine' in Azure
3. Finds best match: 'Virtual-Machines.svg'
4. Updates icon path

**Result:**
```javascript
{
  matched: false,  // Icon didn't exist
  deviceType: 'virtual-machine',
  iconPath: 'src/Icons/Azure/Compute/Virtual-Machines.svg',
  displayName: 'Virtual Machines',
  matchScore: 0.8,
  matchReason: 'exact device type, Azure provider match'
}
```

---

## Benefits

### 1. **Intelligent Matching**
- Uses fuzzy matching instead of exact string comparisons
- Handles variations in naming (e.g., 'vm' vs 'virtual-machine')
- Keyword extraction for semantic matching

### 2. **Database-Driven**
- Leverages 600+ Azure icons in database
- Automatically uses newly added device types
- Consistent with icon migration system

### 3. **Graceful Fallbacks**
- Category-based fallback if no exact match
- Provider-specific fallback (AWS vs Azure)
- Safe generic fallback as last resort

### 4. **Performance**
- Batch matching for multiple resources
- Async operations don't block UI
- Database query caching in main process

### 5. **Debugging**
- Detailed match scores and reasons
- Console logs for match decisions
- Easy to tune scoring thresholds

---

## Configuration

### Matching Thresholds

Located in `electron/ipc/device-types.js` and `src/lib/utils/deviceTypeMatcher.ts`:

```javascript
// Minimum score to accept match
const MIN_MATCH_SCORE = 20  // Out of 100

// Similarity threshold for fuzzy string matching
const FUZZY_THRESHOLD = 0.7  // 70% similarity

// Import match score threshold
const IMPORT_MATCH_THRESHOLD = 0.5  // Only update if >50% confidence
```

### Scoring Weights

```javascript
const SCORING = {
  EXACT_DEVICE_TYPE: 50,
  FUZZY_DEVICE_TYPE: 40,
  EXACT_SUBTYPE: 30,
  FUZZY_SUBTYPE: 20,
  CATEGORY_MATCH: 20,
  PROVIDER_MATCH: 15,
  KEYWORD_MATCH: 10,  // Per keyword
  DISPLAY_NAME_SIMILARITY: 15
}
```

---

## Testing

### Manual Testing

1. **Terraform Import:**
   ```bash
   # Import AWS plan
   terraform plan -out=plan.tfplan
   terraform show -json plan.tfplan > plan.json
   # Import via UI
   ```

2. **Template Import:**
   ```bash
   # Export project as JSON
   # Modify icon paths
   # Re-import
   # Verify icons are corrected
   ```

3. **Check Logs:**
   ```javascript
   // Main process console
   [device-types:find-match] Matched aws_instance -> virtual-machine (score: 1.00)

   // Renderer console
   [deviceTypeImportMatcher] Successfully matched 15/20 devices
   ```

### Automated Testing

Create test in `tests/unit/terraform/`:

```typescript
describe('Device Type Matching', () => {
  it('should match AWS EC2 to virtual-machine', async () => {
    const result = await mapTerraformResourceAsync({
      provider: 'aws',
      resourceType: 'aws_instance',
      resourceAttributes: { name: 'test-vm' }
    })

    expect(result.deviceType).toBe('virtual-machine')
    expect(result.iconPath).toContain('Amazon-Ec2.svg')
  })

  it('should fallback gracefully for unknown types', async () => {
    const result = await mapTerraformResourceAsync({
      provider: 'aws',
      resourceType: 'aws_unknown_resource',
      resourceAttributes: {}
    })

    expect(result.iconPath).toBeDefined()
    expect(result.deviceType).toBeDefined()
  })
})
```

---

## Future Enhancements

1. **Machine Learning:**
   - Train model on historical imports
   - Learn user preferences for ambiguous matches

2. **User Overrides:**
   - Allow users to define custom mappings
   - Store overrides in user preferences

3. **Multi-Provider Support:**
   - Add GCP mapper
   - Add generic cloud provider mapper

4. **Icon Suggestions:**
   - Show top 3 matches in UI
   - Let user choose preferred icon

5. **Performance Optimization:**
   - Cache match results per session
   - Pre-compute similarity matrices

---

## Troubleshooting

### Issue: All imports use generic icons

**Cause:** Device types database not populated

**Solution:**
```bash
# Check database
npm run electron:dev
# In main process console, look for:
# "Device icon cache initialized with 0 entries"

# Migrate device types
# In app, open developer tools and run:
await window.electronAPI.migrateDeviceTypes()

# Or restart app (auto-migration should trigger)
```

### Issue: Poor matches (low scores)

**Cause:** Scoring thresholds too strict or missing keywords

**Solution:**
1. Check logs for match reasons
2. Adjust thresholds in `device-types.js`
3. Add more keywords to static mappings

### Issue: Async errors during import

**Cause:** electronAPI not available

**Solution:**
- Ensure app is running in Electron environment
- Check preload.mjs exposed API correctly
- Fallback to sync mapping gracefully

---

## Files Modified

### Core Logic
- `src/lib/utils/deviceTypeMatcher.ts` (NEW)
- `src/lib/utils/deviceTypeImportMatcher.ts` (NEW)
- `electron/ipc/device-types.js` (UPDATED)

### Terraform Integration
- `src/lib/terraform/resourceMapper.ts` (UPDATED)
- `src/lib/terraform/resourceMappers/awsMapper.ts` (UPDATED)
- `src/lib/terraform/resourceMappers/azureMapper.ts` (UPDATED)
- `src/lib/terraform/stateConverter.ts` (UPDATED)
- `src/core/stores/useTerraformStore.ts` (UPDATED)

### Import Integration
- `src/core/stores/useFlowStore.ts` (UPDATED)

### IPC Types
- `src/window.d.ts` (UPDATED)
- `electron/preload.mjs` (UPDATED)

---

## Summary

The Device Type Matching system provides intelligent, database-driven matching of imported resources to existing device types. It uses fuzzy matching with multiple scoring criteria to ensure the best possible match, with graceful fallbacks for unknown types.

**Key Benefits:**
✅ No more generic icons for known services
✅ Automatic icon correction for outdated imports
✅ Leverages full database of 600+ icons
✅ Provider-aware matching (AWS vs Azure)
✅ Extensible scoring system

**Impact:**
- Terraform imports now use correct, service-specific icons
- Template imports automatically update to current icon set
- Consistent visual representation across imports
