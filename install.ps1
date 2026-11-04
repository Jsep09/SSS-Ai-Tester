param([string]$SkillsDir)
$ErrorActionPreference = 'Stop'
$installer = Join-Path $PSScriptRoot 'bin/install.mjs'
if ($SkillsDir) { & node $installer --skills-dir $SkillsDir }
else { & node $installer }
exit $LASTEXITCODE
