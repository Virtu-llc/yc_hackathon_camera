import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import base64 from 'base-64';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import OpenAI from 'openai';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Button, Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GOOGLE_MAPS_API_KEY, OPENAI_API_KEY } from '../../config';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWaitingForAI, setIsWaitingForAI] = useState(false);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const [activeZoomFactor, setActiveZoomFactor] = useState(1);
  const [selectedLens, setSelectedLens] = useState('Back Camera');
  const [digitalZoom, setDigitalZoom] = useState(0);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
      getAddressFromCoordinates(location.coords.latitude, location.coords.longitude);
    })();

    requestAudioPermission();

    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
    });
  }, []);

  async function requestAudioPermission() {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need audio permissions to play advice!');
    }
  }

  async function getAddressFromCoordinates(latitude: number, longitude: number) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const json = await response.json();
      if (json.results && json.results[0]) {
        setAddress(json.results[0].formatted_address);
      } else {
        setErrorMsg('Address not found');
      }
    } catch (error) {
      console.error(error);
      setErrorMsg('Failed to fetch address');
    }
  }

  const handleZoomPress = (factor: number) => {
    setActiveZoomFactor(factor);
    if (factor === 1) {
      setSelectedLens('Back Camera');
      setDigitalZoom(0);
    } else if (factor === 2) {
      setSelectedLens('Back Camera');
      // This is a digital zoom achieved by cropping the main sensor, similar to the native camera.
      // The value is a percentage of the max zoom available. 0.042 corresponds to ~2x zoom.
      setDigitalZoom(0.042);
    }
  };

  async function handleCapturePhoto() {
    if (cameraRef.current) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        const photo = await cameraRef.current.takePictureAsync({
          quality: 1,
          base64: false,
        });

        await CameraRoll.save(`file://${photo.uri}`, { type: 'photo' });
        console.log('Photo captured and saved:', photo.uri);

        // Flash animation
        Animated.sequence([
          Animated.timing(flashOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(flashOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start();

      } catch (error) {
        console.error('Failed to capture photo:', error);
      }
    }
  }

  async function handleCoachPress() {
    if (!cameraRef.current || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setIsWaitingForAI(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        base64: true,
      });

      if (photo.base64) {
        const prompt = `You are a photography coach. Analyze this image and provide a very short, clear, directional instruction to improve it. Your response must be under 10 words. For example: 'Move slightly right.' or 'Tilt camera down.'`;

        console.log('Calling GPT for advice...');
        const response = await openai.chat.completions.create({
          model: 'gpt-4.1-nano',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${photo.base64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 100,
        });

        const newAdvice = response.choices[0].message.content;
        console.log('Received advice from GPT:', newAdvice);
        setIsWaitingForAI(false);

        if (newAdvice) {
          await textToSpeechAndPlay(newAdvice);
        }
      } else {
        setIsWaitingForAI(false);
      }
    } catch (error) {
      console.error('Error during coaching process:', error);
      setIsWaitingForAI(false);
    } finally {
      setIsProcessing(false);
    }
  }

  async function textToSpeechAndPlay(text: string): Promise<void> {
    console.log('Generating speech for:', text);
    try {
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
      });

      const arrayBuffer = await mp3.arrayBuffer();
      const base64Audio = base64.encode(String.fromCharCode.apply(null, new Uint8Array(arrayBuffer) as any));
      const speechFile = FileSystem.cacheDirectory + 'speech.mp3';
      await FileSystem.writeAsStringAsync(speechFile, base64Audio, { encoding: FileSystem.EncodingType.Base64 });

      const { sound } = await Audio.Sound.createAsync({ uri: speechFile });

      return new Promise((resolve, reject) => {
        sound.setOnPlaybackStatusUpdate(async (status) => {
          try {
            if (status.isLoaded) {
              if (status.didJustFinish) {
                await sound.unloadAsync();
                console.log('Sound unloaded.');
                resolve();
              }
            } else {
              if (status.error) {
                console.error(`Playback Error: ${status.error}`);
                await sound.unloadAsync();
                reject(new Error(status.error));
              }
            }
          } catch (e) {
            console.error('Error in onPlaybackStatusUpdate:', e);
            reject(e);
          }
        });
        sound.playAsync().catch(reject);
      });
    } catch (error) {
      console.error('Failed to generate or play speech', error);
      throw error;
    }
  }

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        zoom={digitalZoom}
        selectedLens={Platform.OS === 'ios' ? selectedLens : undefined}
        onMountError={(e) => console.error(e.message)}
      >
        <View style={styles.controlsContainer}>
          <Text style={styles.locationText}>
            {errorMsg ? errorMsg : address ? address : 'Fetching location...'}
          </Text>
          <View style={styles.zoomControls}>
            {[
              { factor: 1, label: '1x' },
              { factor: 2, label: '2' },
            ].map(({ factor, label }) => (
              <TouchableOpacity
                key={factor}
                style={[
                  styles.zoomButton,
                  activeZoomFactor === factor && styles.activeZoomButton,
                ]}
                onPress={() => handleZoomPress(factor)}
              >
                <Text style={styles.zoomText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </CameraView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.shutterButton} onPress={handleCapturePhoto} />
        <TouchableOpacity style={styles.coachButton} onPress={handleCoachPress} disabled={isProcessing}>
          {isProcessing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.coachButtonText}>Coach</Text>
          )}
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.flash, { opacity: flashOpacity }]} />
    </View>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const cameraHeight = screenWidth * 4 / 3;
const bottomBarHeight = (screenHeight - cameraHeight) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'black',
  },
  camera: {
    width: screenWidth,
    height: cameraHeight,
  },
  controlsContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  locationText: {
    position: 'absolute',
    top: 20,
    left: 20,
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 5,
    fontSize: 12,
  },
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeZoomButton: {
    borderColor: 'yellow',
  },
  zoomText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: bottomBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    borderWidth: 4,
    borderColor: '#ccc',
  },
  coachButton: {
    position: 'absolute',
    right: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  coachButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    marginTop: 10,
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
  },
  flash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
  },
});