class Todo < Formula
  desc "Command-line todo.txt manager with focus, recurrence, and events"
  homepage "https://github.com/caritos/todo-txt"
  version "1.0.0"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/caritos/todo-txt/releases/download/v#{version}/todo-darwin-arm64"
      sha256 "dce3c6020270ca119aabb1f8fc62288f894b2f331bd2a7b4f9cfcf631da6324f"
    else
      url "https://github.com/caritos/todo-txt/releases/download/v#{version}/todo-darwin-x64"
      sha256 "5d56f903f0de2764a8ae40b321c10eb03faa8e8fe0f43ab4237b58b90f47ee97"
    end
  end

  def install
    if Hardware::CPU.arm?
      bin.install "todo-darwin-arm64" => "t"
    else
      bin.install "todo-darwin-x64" => "t"
    end
  end

  test do
    assert_match "Usage", shell_output("#{bin}/t help")
  end
end
