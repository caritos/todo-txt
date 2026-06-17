class Todo < Formula
  desc "Command-line todo.txt manager with focus, recurrence, and events"
  homepage "https://github.com/caritos/todo-txt"
  version "0.1.0"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/caritos/todo-txt/releases/download/v#{version}/todo-darwin-arm64"
      sha256 "REPLACE_WITH_ARM64_SHA256"
    else
      url "https://github.com/caritos/todo-txt/releases/download/v#{version}/todo-darwin-x64"
      sha256 "REPLACE_WITH_X64_SHA256"
    end
  end

  def install
    if Hardware::CPU.arm?
      bin.install "todo-darwin-arm64" => "todo"
    else
      bin.install "todo-darwin-x64" => "todo"
    end
  end

  test do
    assert_match "Usage", shell_output("#{bin}/todo help")
  end
end
