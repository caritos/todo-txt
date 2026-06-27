require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoIcloud'
  s.version        = package['version']
  s.summary        = 'iCloud container initialization for React Native'
  s.description    = 'Calls URLForUbiquityContainerIdentifier: to initialize the iCloud ubiquity container before file writes.'
  s.license        = { :type => 'MIT' }
  s.author         = 'Eladio Caritos'
  s.homepage       = 'https://github.com/caritos/todo-txt'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.source_files   = 'ios/**/*.{h,m}'
  s.dependency 'React-Core'
end
