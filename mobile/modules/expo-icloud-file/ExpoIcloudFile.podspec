require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoIcloudFile'
  s.version        = package['version']
  s.summary        = package['description']
  s.license        = package['license']
  s.author         = ''
  s.homepage       = 'https://github.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :path => '.' }
  s.source_files   = 'ios/**/*.{h,m}'
  s.requires_arc   = true
  s.dependency 'React-Core'
end
