Pod::Spec.new do |s|
  s.name           = 'AppleChat'
  s.version        = '1.0.0'
  s.summary        = 'Critterboard chat on Apple Intelligence (Foundation Models)'
  s.license        = 'MIT'
  s.author         = 'Critterboard'
  s.homepage       = 'https://github.com/krzysztofradomski/critterboard'
  s.platforms      = { :ios => '17.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.weak_frameworks = 'FoundationModels'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
end
