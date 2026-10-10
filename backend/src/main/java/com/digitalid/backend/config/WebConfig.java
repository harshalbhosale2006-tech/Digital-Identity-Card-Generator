package com.digitalid.backend.config;
import com.digitalid.backend.interceptor.SessionAuthInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import java.util.Arrays;
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Value("${app.cors.allowed-origins}") private String allowedOrigins;
    @Override public void addInterceptors(InterceptorRegistry registry){registry.addInterceptor(new SessionAuthInterceptor()).addPathPatterns("/api/cards/**","/api/uploads/**");}
    @Override public void addCorsMappings(CorsRegistry registry){
        String[] origins=Arrays.stream(allowedOrigins.split(",")).map(String::trim).filter(s->!s.isEmpty()).toArray(String[]::new);
        registry.addMapping("/api/**").allowedOrigins(origins).allowedMethods("GET","POST","PUT","PATCH","DELETE","OPTIONS")
            .allowedHeaders("Content-Type","X-Requested-With").allowCredentials(true).maxAge(3600);
    }
}
