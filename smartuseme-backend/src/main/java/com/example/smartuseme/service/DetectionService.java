package com.example.smartuseme.service;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.client.WebClient;

@Service
public class DetectionService {

    private final WebClient webClient;

    public DetectionService(WebClient webClient) {
        this.webClient = webClient;
    }

    public String detectGarbage(MultipartFile file) throws Exception {
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("frame", new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return file.getOriginalFilename();
            }
        });

        return webClient.post()
                .uri("/predict")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .bodyValue(builder.build())
                .retrieve()
                .bodyToMono(String.class)
                .block();
    }

    public String checkPythonHealth() {
    return webClient.get()
            .uri("/")
            .retrieve()
            .bodyToMono(String.class)
            .block();
}
}