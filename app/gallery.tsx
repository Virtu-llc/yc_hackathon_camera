import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Dimensions, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function GalleryScreen() {
    const { images: imagesString } = useLocalSearchParams<{ images: string }>();
    const images: { [key: string]: { imageUrl: string; instagramLink: string }[] } = imagesString ? JSON.parse(imagesString) : {};

    const openInstagramLink = (instagramLink: string) => {
        Linking.openURL(instagramLink);
    };

    return (
        <ScrollView style={styles.container}>
            {Object.keys(images).map(attraction => (
                <View key={attraction} style={styles.attractionSection}>
                    <Text style={styles.attractionTitle}>{attraction}</Text>
                    <View style={styles.imageGrid}>
                        {images[attraction].map((imageData, index) => (
                            <TouchableOpacity key={index} onPress={() => openInstagramLink(imageData.instagramLink)}>
                                <Image source={{ uri: imageData.imageUrl }} style={styles.image} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ))}
        </ScrollView>
    );
}

const screenWidth = Dimensions.get('window').width;
const imageSize = (screenWidth - 40) / 3; // 10 padding on each side of the screen, 10 padding between images

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        paddingHorizontal: 10,
    },
    attractionSection: {
        marginBottom: 20,
    },
    attractionTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
        marginLeft: 5,
        marginTop: 20,
    },
    imageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    image: {
        width: imageSize,
        height: imageSize,
        margin: 5,
        borderRadius: 5,
        backgroundColor: 'grey',
    },
});