#!/usr/bin/env python3
import os
import re
from pathlib import Path
from collections import defaultdict

def normalize_name(filename):
    """Normalize filename to Pascal-Case with hyphens"""
    # Remove extension
    name = filename.replace('.svg', '')
    
    # Remove AWS/Azure prefixes and suffixes
    name = re.sub(r'^(Res_|Arch_|Arch-|Arch-Category_)', '', name)
    name = re.sub(r'_\d+(_Dark|_Light)?$', '', name)
    name = re.sub(r'-\d+$', '', name)
    
    # Remove weird numeric prefixes
    name = re.sub(r'^\d+-', '', name)
    name = re.sub(r'^\d+ ', '', name)
    
    # Convert to Pascal-Case with hyphens
    # Handle spaces, underscores, and mixed case
    name = re.sub(r'[_\s]+', '-', name)
    # Split on hyphens and capitalize each word
    parts = name.split('-')
    parts = [p.capitalize() if p else '' for p in parts]
    name = '-'.join(parts)
    
    # Clean up multiple hyphens
    name = re.sub(r'-+', '-', name)
    name = name.strip('-')
    
    return name + '.svg'

def get_file_priority(filepath):
    """Return priority score - higher is better"""
    name = filepath.name.lower()
    score = 0
    
    # Prefer files without size suffixes (cleaner names)
    if not re.search(r'_\d+(_dark|_light)?\.svg$', name):
        score += 100
    
    # Prefer 48 or 64 size over 16 or 32
    if re.search(r'_48(_dark|_light)?\.svg$', name):
        score += 50
    elif re.search(r'_64(_dark|_light)?\.svg$', name):
        score += 40
    elif re.search(r'_32(_dark|_light)?\.svg$', name):
        score += 20
    elif re.search(r'_16(_dark|_light)?\.svg$', name):
        score += 10
    
    # Prefer light over dark
    if '_light' in name:
        score += 5
    elif '_dark' in name:
        score += 1
    
    # Prefer files without AWS/Azure prefixes
    if not name.startswith(('res_', 'arch_', 'arch-')):
        score += 30
    
    return score

# Find all SVG files
files = list(Path('.').rglob('*.svg'))
print(f"Found {len(files)} SVG files")

# Group by normalized name to find duplicates
name_map = defaultdict(list)
for f in files:
    norm_name = normalize_name(f.name)
    name_map[norm_name].append(f)

# Process duplicates - keep the best version
renamed_count = 0
removed_count = 0
renamed_files = {}

for norm_name, paths in name_map.items():
    if len(paths) > 1:
        # Sort by priority
        paths_sorted = sorted(paths, key=get_file_priority, reverse=True)
        # Keep the best one
        keep_file = paths_sorted[0]
        # Remove duplicates
        for dup_file in paths_sorted[1:]:
            dup_file.unlink()
            removed_count += 1
        # Rename the kept file if needed
        if keep_file.name != norm_name:
            new_path = keep_file.parent / norm_name
            keep_file.rename(new_path)
            renamed_count += 1
            renamed_files[keep_file] = new_path
    else:
        # Single file - just rename if needed
        file = paths[0]
        if file.name != norm_name:
            new_path = file.parent / norm_name
            file.rename(new_path)
            renamed_count += 1
            renamed_files[file] = new_path

print(f"\nRenamed {renamed_count} files")
print(f"Removed {removed_count} duplicate files")
print(f"Final count: {len(name_map)} unique files")

