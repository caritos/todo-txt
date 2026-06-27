require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoIcloud'
  s.version        = package['version']
  s.summary        = 'iCloud container initialization for Expo'
  s.description    = 'Calls url(forUbiquityContainerIdentifier:) to initialize the iCloud ubiquity container before file writes.'
  s.license        = { :type => 'MIT' }
  s.author         = 'Eladio Caritos'
  s.homepage       = 'https://github.com/caritos/todo-txt'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.4'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = 'ios/**/*.swift'
end
