package com.digitalid.backend.controller;
import com.digitalid.backend.dto.CardRequest;
import com.digitalid.backend.dto.CardResponse;
import com.digitalid.backend.dto.CardStatsResponse;
import com.digitalid.backend.service.CardService;
import com.digitalid.backend.service.VerificationUrlService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController
@RequestMapping("/api/cards")
public class CardController {
    private final CardService service;
    private final VerificationUrlService verificationUrls;
    public CardController(CardService service, VerificationUrlService verificationUrls){this.service=service;this.verificationUrls=verificationUrls;}
    @GetMapping public Page<CardResponse> list(@RequestParam(required=false)String q,@RequestParam(required=false)String status,@RequestParam(required=false)String department,@RequestParam(required=false)String course,@RequestParam(required=false)String year,@RequestParam(required=false)String semester,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size,@RequestParam(defaultValue="createdAt")String sortBy,@RequestParam(defaultValue="desc")String direction){return service.search(q,status,department,course,year,semester,page,size,sortBy,direction).map(this::toResponse);}
    @GetMapping("/stats") public CardStatsResponse stats(){return service.stats();}
    @GetMapping("/number/{idNumber}") public CardResponse byNumber(@PathVariable String idNumber){return toResponse(service.getByNumber(idNumber));}
    @GetMapping("/{id}") public CardResponse get(@PathVariable Long id){return toResponse(service.get(id));}
    @PostMapping public ResponseEntity<CardResponse> create(@Valid @RequestBody CardRequest request){return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(service.create(request)));}
    @PutMapping("/{id}") public CardResponse update(@PathVariable Long id,@Valid @RequestBody CardRequest request){return toResponse(service.update(id,request));}
    @PatchMapping("/{id}/status") public CardResponse status(@PathVariable Long id,@RequestBody Map<String,String> body){return toResponse(service.updateStatus(id,body.get("status")));}
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id){service.delete(id);return ResponseEntity.noContent().build();}
    private CardResponse toResponse(com.digitalid.backend.entity.IdCard card){return CardResponse.from(card,verificationUrls.forToken(card.getVerificationToken()));}
}
