import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import base64 from 'base-64';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Link } from 'expo-router';
import OpenAI from 'openai';
import { useEffect, useRef, useState } from 'react';
import { Animated, Button, Dimensions, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GOOGLE_MAPS_API_KEY, GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_CX, OPENAI_API_KEY } from '../../config';

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
  const [isGeneratingWelcomeMessage, setIsGeneratingWelcomeMessage] = useState(false);
  const [touristAttractions, setTouristAttractions] = useState<string[]>([]);
  const hasPlayedWelcomeMessage = useRef(false);
  const [isWelcomeMessagePlaying, setIsWelcomeMessagePlaying] = useState(true);
  const [hasSearchedImages, setHasSearchedImages] = useState(false);
  const [instagramImages, setInstagramImages] = useState<{ [key: string]: { imageUrl: string; instagramLink: string }[] }>({});

  // For auto-coach functionality
  const [lastImageSize, setLastImageSize] = useState<number | null>(null);
  const [stableCount, setStableCount] = useState(0);
  const [isSuggestionTaskRunning, setIsSuggestionTaskRunning] = useState(false);
  const isTaskCancelled = useRef(false);
  const suggestionAbortController = useRef<AbortController | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);


  useEffect(() => {
    (async () => {
      await requestAudioPermission();

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
      });

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
      getAddressFromCoordinates(location.coords.latitude, location.coords.longitude);
      getTouristAttractions(location.coords.latitude, location.coords.longitude);
    })();
  }, []);

  useEffect(() => {
    if (address && touristAttractions.length > 0 && !hasPlayedWelcomeMessage.current) {
      generateAndPlayWelcomeMessage(address, touristAttractions);
      hasPlayedWelcomeMessage.current = true;
    }
    if (touristAttractions.length > 0 && !hasSearchedImages) {
      searchInstagramImages(touristAttractions);
      setHasSearchedImages(true);
    }
  }, [address, touristAttractions, hasSearchedImages]);

  useEffect(() => {
    // Do not start stability check until the welcome message has finished playing.
    if (isWelcomeMessagePlaying) {
      return;
    }

    const checkStability = async () => {
      // Re-check conditions that might have changed, like another suggestion starting.
      if (!cameraRef.current || isSuggestionTaskRunning || isProcessing || isWaitingForAI || isGeneratingWelcomeMessage) {
        return;
      }

      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.1, skipProcessing: true });
        const fileInfo = await FileSystem.getInfoAsync(photo.uri, { size: true });
        await FileSystem.deleteAsync(photo.uri);

        if (fileInfo.exists && typeof fileInfo.size === 'number') {
          const currentSize = fileInfo.size;
          
          setLastImageSize(lastSize => {
            if (lastSize !== null) {
              const sizeDifference = Math.abs(currentSize - lastSize) / lastSize;
              if (sizeDifference < 0.05) { // 5% threshold for similarity
                setStableCount(prev => prev + 1);
              } else {
                setStableCount(0);
                if (isSuggestionTaskRunning) {
                    isTaskCancelled.current = true;
                    if (suggestionAbortController.current) {
                        suggestionAbortController.current.abort();
                    }
                    if (soundRef.current) {
                        soundRef.current.stopAsync().then(() => {
                          soundRef.current?.unloadAsync();
                          soundRef.current = null;
                        });
                    }
                    setIsSuggestionTaskRunning(false);
                    console.log('Task cancelled due to camera movement.');
                }
              }
            }
            return currentSize;
          });
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('permission')) {
          console.log('Camera permission not granted yet, skipping stability check.');
        } else {
          console.error("Error checking stability:", error);
        }
      }
    };

    const intervalId = setInterval(checkStability, 1000);

    return () => clearInterval(intervalId);
  }, [isWelcomeMessagePlaying, isSuggestionTaskRunning, isProcessing, isWaitingForAI, isGeneratingWelcomeMessage]);

  useEffect(() => {
    if (stableCount >= 2 && !isSuggestionTaskRunning) {
      console.log('Camera is stable. Triggering suggestion task.');
      handleCoachPress();
    }
  }, [stableCount, isSuggestionTaskRunning]);

  async function requestAudioPermission() {
    console.log('Requesting audio recording permissions...');
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need audio permissions to play advice!');
    }
  }

  async function searchInstagramImages(attractions: string[]) {
    console.log('Searching for Instagram images of:', attractions);
    const allImages: { [key: string]: { imageUrl: string; instagramLink: string }[] } = {};
    for (const attraction of attractions) {
      try {
        const query = `"${attraction}"`;
        const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_CX}&q=${encodeURIComponent(query)}&searchType=image&siteSearch=instagram.com&fields=items(link,image)`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.items) {
          const imageData = data.items.map((item: any) => ({
            imageUrl: item.image?.thumbnailLink || item.link,
            instagramLink: item.link
          }));
          console.log(`Image data for ${attraction}:`, imageData);
          allImages[attraction] = imageData;
        } else {
          console.log(`No images found for ${attraction} on Instagram.`);
        }
      } catch (error) {
        console.error(`Failed to search images for ${attraction}`, error);
      }
    }
    setInstagramImages(allImages);
  }

  async function getTouristAttractions(latitude: number, longitude: number) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=1500&type=tourist_attraction&key=${GOOGLE_MAPS_API_KEY}`
      );
      const json = await response.json();
      if (json.results) {
        const attractions = json.results.map((place: any) => place.name).slice(0, 5);
        setTouristAttractions(attractions);
        console.log('Tourist Attractions:', attractions);
      }
    } catch (error) {
      console.error('Failed to fetch tourist attractions', error);
    }
  }

  async function getAddressFromCoordinates(latitude: number, longitude: number) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const json = await response.json();
      if (json.results && json.results[0]) {
        const fullAddress = json.results[0].formatted_address;
        setAddress(fullAddress);
      } else {
        setErrorMsg('Address not found');
      }
    } catch (error) {
      console.error(error);
      setErrorMsg('Failed to fetch address');
    }
  }

  async function generateAndPlayWelcomeMessage(currentAddress: string, attractions: string[]) {
    if (isGeneratingWelcomeMessage || !cameraRef.current) return;

    setIsGeneratingWelcomeMessage(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        base64: true,
      });

      if (photo.base64) {
        let attractionsText = '';
        if (attractions.length > 0) {
          attractionsText = `Nearby tourist attractions include: ${attractions.join(', ')}.`;
        }
  
        const prompt = `
        You are a photography assistant. The user is currently at ${currentAddress}. Here are the attractions nearby: ${attractionsText}.
        Based on the provided image, reason about the EXACT location the user is at, what the user is wearing, how's the weather, greet them and suggest a few interesting photo opportunities or beautiful scenes nearby, starting from the current place they are at. 
        - Be specific about the current location the user is at, Be exact about how many photos they can take and what they can capture.
        - Be enthusiastic and encouraging, appreciating the users's current setting and outfit.
        - Encourage the user to start taking photos right away at the current location.
        - Keep your response concise and friendly, under 150 words.
        - For example: 'Such an iconic cloudy day at the Eiffel Tower! With your hat, scarf, and black coat, you’re perfectly styled for moody cinematic photos that glow in soft light. Based on this vibe, you can capture around 4 breathtaking shots within the next 20 minutes—Trocadéro (5 min walk), Avenue de Camoëns (just 2 min away), Bir-Hakeim Bridge (10 min stroll), and Quai Branly by the Seine (3 min). These four stops offer sweeping panoramas, chic Parisian streets, dramatic cinematic lines, and soft river reflections, all in a short loop. Let's start with your current location! Can you start pointing your camera at the gorgeous subject?'`;

        console.log('Calling GPT for welcome message with image...');
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
          max_tokens: 200,
        });

        const message = response.choices[0].message.content;
        console.log('Received welcome message from GPT:', message);

        if (message) {
          await textToSpeechAndPlay(message);
        }
      }
    } catch (error) {
      console.error('Error generating welcome message:', error);
    } finally {
      setIsGeneratingWelcomeMessage(false);
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
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

  const handleCoachPress = async () => {
    if (isProcessing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setIsSuggestionTaskRunning(true);
    isTaskCancelled.current = false;
    suggestionAbortController.current = new AbortController();

    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.5, base64: true });
      if (!photo || isTaskCancelled.current) return;

      const base64 = photo.base64;
      if (!base64 || isTaskCancelled.current) return;

      setIsWaitingForAI(true);

      const prompt = `
      You are a friendly and encouraging photography assistant. Analyze the current frame, check if it's of good {Scene Background, Distance, Lighting, Composition, Pose, Lens/Distance, Trend-Scout) and provide a very short, clear, directional instruction to improve it. If all the aspects are great and the photo looks of good quality, just say 'Perfect! Hold still and shoot now!'.
      - Don't be too harsh or negative, always be positive and encouraging.
      - Encourage the user to take the photo right away if the current frame is good.
      - Always apply a template of action + photograph technical effect + aesthetic reason.
      - Use professional photography suggestions:
        - Scene Background: Suggest changing location or angle for better background, detect if the background has distractions like trashbins, poles, photobombers, etc.
        - Distance: Suggest moving closer or further for better framing of the subject.
        - Lighting: Detect lighting sources and whether it's top-down, side, back, natural, artificial, golden hour, harsh midday sun, etc. Suggest changing position relative to light source for better lighting.
        - Composition: Suggest using rule of thirds, leading lines, or symmetry for better composition.
        - Pose: Suggest changing pose or expression for better subject appearance.
        - Lens/Distance: Suggest changing lens or distance for better perspective.
        - Trend-Scout: Suggest incorporating current photography trends for a modern look.
      - Your response must be under 15 words, and be extremely specific and actionable with numbers like degrees, steps, distance, etc. 
      - Examples are: 'Move two steps right, remove bin, keep scene clean.', 'Tilt camera down 10°, shrink model's face, refine proportions.', 'Zoom in to 2x, compress view, bring model closer to scenery.', 'Turn model 15° left, adjust angles, look slimmer.', 'Place feet on bottom line, stretch frame, make model look taller.', 'Perfect! Hold still and shoot now!';
      `;

      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-nano',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text:  prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`,
                },
              },
            ],
          },
        ],
      }, { signal: suggestionAbortController.current.signal });

      setIsWaitingForAI(false);

      if (isTaskCancelled.current) return;

      const suggestion = response.choices[0].message.content;
      if (suggestion) {
        await textToSpeechAndPlay(suggestion);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('OpenAI request was aborted.');
      } else {
        console.error('Error with Coach:', error);
      }
      setIsWaitingForAI(false);
    } finally {
      setIsSuggestionTaskRunning(false);
      setStableCount(0);
      setLastImageSize(null);
    }
  };


  async function textToSpeechAndPlay(text: string): Promise<void> {
    try {
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: text,
      });

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      uint8Array.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      const base64Audio = base64.encode(binary);

      const speechFile = FileSystem.cacheDirectory + 'speech.mp3';
      await FileSystem.writeAsStringAsync(speechFile, base64Audio, { encoding: FileSystem.EncodingType.Base64 });

      if (isTaskCancelled.current) {
        console.log('TTS playback cancelled before starting.');
        return;
      }

      const { sound } = await Audio.Sound.createAsync({ uri: speechFile });
      soundRef.current = sound;

      return new Promise((resolve, reject) => {
        sound.setOnPlaybackStatusUpdate(async (status) => {
          try {
            if (status.isLoaded) {
              if (status.didJustFinish) {
                await sound.unloadAsync();
                soundRef.current = null;
                console.log('Sound unloaded.');
                setIsWelcomeMessagePlaying(false);
                resolve();
              }
            } else {
              if (status.error) {
                console.error(`Playback Error: ${status.error}`);
                await sound.unloadAsync();
                soundRef.current = null;
                setIsWelcomeMessagePlaying(false);
                reject(new Error(status.error));
              }
            }
          } catch (e) {
            console.error('Error in onPlaybackStatusUpdate:', e);
            reject(e);
          }
        });

        if (!isTaskCancelled.current) {
          sound.playAsync().catch(reject);
        } else {
          sound.unloadAsync();
          soundRef.current = null;
          resolve();
        }
      });
    } catch (error) {
      console.error('Failed to generate or play speech', error);
      setIsWelcomeMessagePlaying(false);
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

  const firstAttraction = Object.keys(instagramImages)[0];
  const thumbnailUrl = firstAttraction ? instagramImages[firstAttraction][0]?.imageUrl : null;

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
        <View style={styles.buttonContainerPlaceholder} />
        <TouchableOpacity style={styles.shutterButton} onPress={handleCapturePhoto} />
        <View style={styles.galleryButtonContainer}>
          {thumbnailUrl && (
            <Link href={{ pathname: "/gallery", params: { images: JSON.stringify(instagramImages) } }}>
              <Image source={{ uri: thumbnailUrl }} style={styles.galleryThumbnail} />
            </Link>
          )}
        </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  shutterButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    borderWidth: 4,
    borderColor: '#ccc',
  },
  buttonContainerPlaceholder: {
    width: 50,
    height: 50,
  },
  galleryButtonContainer: {
    width: 50,
    height: 50,
    borderRadius: 5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: 'grey',
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