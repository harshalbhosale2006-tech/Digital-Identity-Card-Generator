package com.digitalid.backend.dto;
public record CardStatsResponse(long total, long active, long pending, long inactive, long blocked) { }
