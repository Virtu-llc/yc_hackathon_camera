import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Dimensions, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function InsposScreen() {
    const { images: imagesString } = useLocalSearchParams<{ images: string }>();
    const images: { [key: string]: { imageUrl: string; instagramLink: string }[] } = imagesString ? JSON.parse(imagesString) : {};

    const openInstagramLink = (instagramLink: string) => {
        Linking.openURL(instagramLink);
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.headerText}>
                    Popular Photo Shootings near by selected and featured by Foxos, your AI powered photograph coaching agent
                </Text>
            </View>
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
const imageSize = (screenWidth - 30) / 3; // 15 padding on each side, no gap between images

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        paddingHorizontal: 15,
    },
    headerContainer: {
        marginTop: 20,
        marginBottom: 30,
        paddingHorizontal: 10,
    },
    headerText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 24,
    },
    attractionSection: {
        marginBottom: 20,
    },
    attractionTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        marginTop: 20,
    },
    imageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    image: {
        width: imageSize,
        height: imageSize,
        marginBottom: 2,
        borderRadius: 3,
        backgroundColor: 'grey',
    },
});