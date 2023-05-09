# Install the emulator tool
sdkmanager --install emulator

# Install an AOSP image that would later be used as the AVD's OS
sdkmanager --install "system-images;android-28;default;x86_64"

# To do that automatically in a script, try this:
yes | sdkmanager --licenses

# Create an AVD with the image we've previously installed
avdmanager --verbose create avd --force --name Pixel_4_API_28 --abi x86_64 --device "pixel" --package "system-images;android-28;default;x86_64"

