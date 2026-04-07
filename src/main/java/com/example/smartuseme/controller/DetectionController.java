package com.smartuseme.controller;

import com.smartuseme.service.DetectionService;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class DetectionController {

    private final DetectionService detectionService;

    public DetectionController(DetectionService detectionService) {
        this.detectionService = detectionService;
    }

    @PostMapping("/detect")
    public String detect(@RequestParam("file") MultipartFile file) throws Exception {
        return detectionService.detectGarbage(file);
    }
}